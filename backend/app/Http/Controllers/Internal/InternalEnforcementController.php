<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Enums\AdminPermission;
use App\Models\Report;
use App\Models\User;
use App\Services\UserEnforcementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Cross-service member enforcement (DEC-011).
 *
 * The marketing/support console is a legitimate second front door for
 * warn/flag/ban, but it is not a second source of truth. These endpoints
 * delegate to UserEnforcementService, which is where the warning gate lives, so
 * calling this service cannot produce an outcome the console could not.
 *
 * Two consequences of that are load-bearing:
 *
 *  1. Every call must name the acting staff member, and that member must exist
 *     in the main backend and hold the `warnings` permission there. A shared
 *     service token proves which *service* is calling, not which human, so the
 *     human is resolved and checked per request rather than inferred.
 *  2. The main backend's state is returned on every call. The caller is
 *     expected to render that, not a local guess — where the two disagreed, the
 *     main backend's value wins.
 */
class InternalEnforcementController extends Controller
{
    public function __construct(private readonly UserEnforcementService $enforcement) {}

    /**
     * POST /internal/enforcement/warn
     */
    public function warn(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'actor_email' => ['required', 'email'],
            'user_id' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:500'],
            'category' => ['nullable', 'string', Rule::in(\App\Models\UserWarning::CATEGORIES)],
            'valid_for_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        [$actor, $failure] = $this->resolveActor($validated['actor_email']);

        if ($actor === null) {
            return $failure;
        }

        $target = User::withTrashed()->find($validated['user_id']);

        if (! $target) {
            return response()->json(['success' => false, 'message' => 'Member not found.'], 404);
        }

        $warning = $this->enforcement->warn(
            actor: $actor,
            target: $target,
            reason: $validated['reason'],
            category: $validated['category'] ?? 'conduct',
            validForDays: $validated['valid_for_days'] ?? 30,
        );

        return response()->json([
            'success' => true,
            'data' => [
                'warning_id' => $warning->id,
                'user_id' => $target->id,
                'status' => $target->refresh()->status,
                'expires_at' => $warning->expires_at?->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * POST /internal/enforcement/ban
     */
    public function ban(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'actor_email' => ['required', 'email'],
            'user_id' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:500'],
            'ban_type' => ['nullable', 'string', Rule::in(UserEnforcementService::BAN_TYPES)],
        ]);

        [$actor, $failure] = $this->resolveActor($validated['actor_email']);

        if ($actor === null) {
            return $failure;
        }

        $target = User::withTrashed()->find($validated['user_id']);

        if (! $target) {
            return response()->json(['success' => false, 'message' => 'Member not found.'], 404);
        }

        try {
            $this->enforcement->ban(
                actor: $actor,
                target: $target,
                reason: $validated['reason'],
                banType: $validated['ban_type'] ?? 'standard',
            );
        } catch (\App\Exceptions\BanGateException $e) {
            // The gate refused. This is a normal, expected outcome — the caller
            // needs to tell the operator to warn the member first, so it is a
            // 422 with a machine-readable code rather than a 500.
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => ['code' => 'warning_required'],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $target->id,
                'status' => $target->refresh()->status,
            ],
        ]);
    }

    /**
     * POST /internal/enforcement/flag-report
     */
    public function flagReport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'actor_email' => ['required', 'email'],
            'report_id' => ['required', 'integer', 'min:1'],
            'flag_note' => ['nullable', 'string', 'max:500'],
        ]);

        [$actor, $failure] = $this->resolveActor($validated['actor_email']);

        if ($actor === null) {
            return $failure;
        }

        $report = Report::find($validated['report_id']);

        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Report not found.'], 404);
        }

        $report->update([
            'status' => 'flagged',
            'flagged_by' => $actor->id,
            'flagged_at' => now(),
            'flag_note' => $validated['flag_note'] ?? null,
            'flag_count' => $report->flag_count + 1,
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'report_id' => $report->id,
                'status' => $report->status,
            ],
        ]);
    }

    /**
     * Resolve the acting staff member and confirm they may enforce.
     *
     * @return array{0: ?User, 1: ?JsonResponse}
     */
    private function resolveActor(string $email): array
    {
        $actor = User::where('role', 'admin')
            ->where('status', 'active')
            ->where('email', $email)
            ->first();

        if (! $actor) {
            return [null, response()->json([
                'success' => false,
                'message' => 'Acting staff member is not an active administrator in the main backend.',
            ], 403)];
        }

        if (! $actor->hasAdminPermission(AdminPermission::Warnings->value)) {
            return [null, response()->json([
                'success' => false,
                'message' => 'Acting staff member does not hold the warnings permission.',
            ], 403)];
        }

        return [$actor, null];
    }
}
