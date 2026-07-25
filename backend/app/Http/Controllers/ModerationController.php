<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\Report;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ModerationController extends Controller
{
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
     * Admin/moderator: list pending reports.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $reports = Report::with('reporter')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->type, fn ($q, $t) => $q->where('reported_type', $t))
            ->latest()
            ->paginate(25);

        return response()->json($reports);
    }

    /**
     * Admin/moderator: action a report (dismiss or action).
     */
    public function action(Request $request, Report $report): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'status' => ['required', Rule::in(['reviewed', 'dismissed', 'actioned'])],
            'review_note' => ['nullable', 'string', 'max:500'],
        ]);

        $report->update([
            'status' => $validated['status'],
            'review_note' => $validated['review_note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        // If actioned on a post — remove it (soft approach: could also use SoftDeletes)
        if ($validated['status'] === 'actioned' && $report->reported_type === 'post') {
            Post::find($report->reported_id)?->delete();
        }

        return response()->json([
            'message' => 'Report updated.',
            'data' => $report->fresh(),
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
