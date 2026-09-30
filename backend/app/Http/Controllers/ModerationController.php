<?php

namespace App\Http\Controllers;

use App\Models\ModerationRule;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\Report;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\UserEnforcementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class ModerationController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly UserEnforcementService $enforcement,
    ) {}

    /**
     * Submit a report against a post, user, or comment.
     */
    public function report(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reported_type' => ['required', Rule::in(['post', 'user', 'comment'])],
            'reported_id' => ['required', 'integer'],
            'reason' => ['required', Rule::in(Report::REASONS)],
            'details' => ['nullable', 'string', 'max:1000'],
        ]);

        // Prevent duplicate pending reports from the same reporter
        $exists = Report::where('reporter_id', $request->user()->id)
            ->where('reported_type', $validated['reported_type'])
            ->where('reported_id', $validated['reported_id'])
            ->where('status', 'pending')
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'You have already reported this content.',
                'code' => 'ALREADY_REPORTED',
            ], 409);
        }

        $report = Report::create([
            'reporter_id' => $request->user()->id,
            'reported_type' => $validated['reported_type'],
            'reported_id' => $validated['reported_id'],
            'reason' => $validated['reason'],
            'details' => $validated['details'] ?? null,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Report submitted. Our moderation team will review it.',
            'data' => $report,
        ], 201);
    }

    /**
     * Admin/moderator: list reports with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'status' => ['nullable', 'string', Rule::in(Report::STATUSES)],
            'type' => ['nullable', 'string', Rule::in(['post', 'user', 'comment'])],
            'reason' => ['nullable', 'string', Rule::in(Report::REASONS)],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $reports = Report::with(['reporter', 'reviewer', 'flagger'])
            ->when($validated['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($validated['type'] ?? null, fn ($q, $t) => $q->where('reported_type', $t))
            ->when($validated['reason'] ?? null, fn ($q, $r) => $q->where('reason', $r))
            ->latest()
            ->paginate($validated['per_page'] ?? 25);

        return response()->json($reports);
    }

    /**
     * Admin/moderator: process a report (flag, dismiss, delete content, warn
     * or ban the author).
     *
     * Member-facing enforcement is deliberately not reachable from here. This
     * action may ban an author, but only through UserEnforcementService, so
     * that the warning gate in DEC-012 cannot be sidestepped by coming in
     * through the moderation queue instead of the Trust & Safety screen.
     */
    public function action(Request $request, Report $report): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'action' => ['required', Rule::in(['flag', 'dismiss', 'delete', 'ban_author'])],
            'review_note' => ['nullable', 'string', 'max:500'],
            'ban_type' => ['nullable', 'string', 'in:standard,emergency'],
        ]);

        $action = $validated['action'];

        $target = match ($report->reported_type) {
            'post' => Post::find($report->reported_id),
            'comment' => PostComment::find($report->reported_id),
            'user' => User::find($report->reported_id),
            default => null,
        };

        $message = 'Report reviewed.';

        $removedAuthor = null;
        $removedContentType = null;

        if ($action === 'delete' && $target && in_array($report->reported_type, ['post', 'comment'], true)) {
            $removedAuthor = $target->author()->first();
            $removedContentType = $report->reported_type;
        }

        // The author whose standing this action would change. A report against
        // a user targets that user directly; a report against a post or comment
        // targets whoever wrote it.
        $author = match ($report->reported_type) {
            'user' => $target,
            'post', 'comment' => $target?->author()->first(),
            default => null,
        };

        $gateFailure = null;

        match ($action) {
            'flag' => $this->flag($report, $request->user(), $validated['review_note'] ?? null),
            'dismiss' => null,
            'delete' => match ($report->reported_type) {
                'post', 'comment' => $target?->delete(),
                default => null,
            },
            'ban_author' => $this->banAuthor($report, $author, $request->user(), $validated, $gateFailure),
        };

        if ($action === 'delete' && ! $target) {
            $message = 'Target content already deleted.';
        }

        if ($removedAuthor) {
            try {
                $this->notifications->actionEmail(
                    user: $removedAuthor,
                    title: 'Your '.$removedContentType.' was removed',
                    bodyHtml: '<p>Your '.$removedContentType.' on MurihSpace was <strong>removed</strong> because it did not comply with our community guidelines.</p>',
                    footnote: 'If you believe this is a mistake, you may contact support.',
                    template: 'content_removed',
                    data: ['content_type' => $removedContentType === 'post' ? 'post' : 'comment'],
                );
            } catch (\Throwable $e) {
                report($e);
            }
        }

        // A ban that the gate refused leaves the report open and untouched, so
        // that the report is not marked actioned for an action that did not
        // happen.
        if ($gateFailure !== null) {
            return response()->json([
                'message' => $gateFailure,
                'code' => 'warning_required',
            ], 422);
        }

        if ($action !== 'flag') {
            $report->update([
                'status' => $action === 'dismiss' ? 'dismissed' : 'actioned',
                'review_note' => $validated['review_note'] ?? null,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);
        }

        // A dismissed report is evidence against the rule that raised it.
        if ($action === 'dismiss' && $this->ruleIdFromDetails($report->details) !== null) {
            $rule = ModerationRule::find($this->ruleIdFromDetails($report->details));

            $rule?->recordVerdict(false);
        }

        if ($action === 'delete' && $this->ruleIdFromDetails($report->details) !== null) {
            $rule = ModerationRule::find($this->ruleIdFromDetails($report->details));

            $rule?->recordVerdict(true);
        }

        return response()->json([
            'message' => $action === 'flag' ? 'Report flagged for closer review.' : $message,
            'data' => $report->fresh(['reporter', 'reviewer', 'flagger']),
        ]);
    }

    /**
     * Escalate a report without resolving it.
     */
    private function flag(Report $report, User $actor, ?string $note): void
    {
        $report->update([
            'status' => 'flagged',
            'flagged_by' => $actor->id,
            'flagged_at' => now(),
            'flag_note' => $note,
            'flag_count' => $report->flag_count + 1,
        ]);
    }

    /**
     * Ban the author of a reported item, subject to the warning gate.
     *
     * $gateFailure is set by reference because the caller still has to resolve
     * the report's own bookkeeping, and a refused ban must leave it open.
     */
    private function banAuthor(
        Report $report,
        ?User $author,
        User $actor,
        array $validated,
        ?string &$gateFailure,
    ): void {
        if ($author === null) {
            $gateFailure = 'The author of this content no longer exists.';

            return;
        }

        $reason = $validated['review_note'] ?? 'Banned for a moderation violation.';

        try {
            $this->enforcement->ban(
                actor: $actor,
                target: $author,
                reason: $reason,
                banType: $validated['ban_type'] ?? 'standard',
            );
        } catch (\App\Exceptions\BanGateException $e) {
            $gateFailure = $e->getMessage();

            return;
        }

        try {
            $this->notifications->actionEmail(
                user: $author,
                title: 'Your account has been banned',
                bodyHtml: '<p>Your MurihSpace account has been <strong>banned</strong> because content on it did not comply with our terms of service.</p>',
                footnote: 'If you believe this decision is in error, you may contact our support team.',
                template: 'user_banned',
            );
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function ruleIdFromDetails(?string $details): ?int
    {
        if ($details === null || ! preg_match('/\[rule:(\d+)\]/', $details, $matches)) {
            return null;
        }

        return (int) $matches[1];
    }

    /**
     * Get open report count for sidebar badge. Flagged reports are open, not
     * resolved, so they belong in the badge; excluding them would hide work
     * that a moderator is expected to pick up.
     */
    public function pendingCount(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json([
            'data' => [
                'pending' => Report::where('status', 'pending')->count(),
                'flagged' => Report::where('status', 'flagged')->count(),
                'open' => Report::whereIn('status', ['pending', 'flagged'])->count(),
            ],
        ]);
    }

    /**
     * Verify the requesting user is an admin or platform moderator.
     */
    private function authorizeAdmin(Request $request): void
    {
        if (! in_array($request->user()->role, ['admin', 'moderator'])) {
            abort(403, 'Insufficient privileges.');
        }
    }
}
