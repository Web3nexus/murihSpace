<?php

namespace App\Http\Controllers;

use App\Models\AccountRoleHistory;
use App\Services\RoleTransitionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleUpgradeController extends Controller
{
    public function __construct(
        private readonly RoleTransitionService $transitions,
    ) {}

    // ──────────────────────────────────────────────────────────────────────
    // User endpoints
    // ──────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/role/application
     * Return the user's current pending (or latest) role application.
     */
    public function myApplication(Request $request): JsonResponse
    {
        $application = AccountRoleHistory::where('user_id', $request->user()->id)
            ->latest()
            ->first();

        return response()->json(['application' => $application]);
    }

    /**
     * GET /api/v1/role/history
     * Return the authenticated user's full role history.
     */
    public function myHistory(Request $request): JsonResponse
    {
        $history = AccountRoleHistory::where('user_id', $request->user()->id)
            ->with('approvedBy:id,name')
            ->latest()
            ->get();

        return response()->json(['history' => $history]);
    }

    /**
     * POST /api/v1/role/apply
     * Submit a role upgrade or lateral change request.
     */
    public function apply(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'requested_role' => ['required', 'string', 'in:creator,vendor,member'],
        ]);

        try {
            $application = $this->transitions->apply(
                user: $request->user(),
                requestedRole: $validated['requested_role'],
            );

            return response()->json([
                'success'     => true,
                'message'     => 'Your role application has been submitted and is under review.',
                'application' => $application,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * DELETE /api/v1/role/apply
     * Cancel the authenticated user's pending application.
     */
    public function cancel(Request $request): JsonResponse
    {
        $application = AccountRoleHistory::where('user_id', $request->user()->id)
            ->where('status', 'pending')
            ->first();

        if (! $application) {
            return response()->json(['message' => 'No pending application found.'], 404);
        }

        try {
            $this->transitions->cancel($application, $request->user());

            return response()->json(['success' => true, 'message' => 'Application cancelled.']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Admin endpoints
    // ──────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/admin/role-applications
     * List all role applications with optional status filter.
     */
    public function adminIndex(Request $request): JsonResponse
    {
        $query = AccountRoleHistory::with(['user:id,name,email,role,avatar_url', 'approvedBy:id,name'])
            ->latest();

        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->has('role')) {
            $query->where('requested_role', $request->input('role'));
        }

        $applications = $query->paginate(25);

        return response()->json($applications);
    }

    /**
     * GET /api/v1/admin/role-applications/{id}
     * Show a single application.
     */
    public function adminShow(int $id): JsonResponse
    {
        $application = AccountRoleHistory::with(['user', 'approvedBy:id,name'])->findOrFail($id);

        return response()->json(['application' => $application]);
    }

    /**
     * PATCH /api/v1/admin/role-applications/{id}/approve
     * Approve a pending role application and activate the new role.
     */
    public function approve(Request $request, int $id): JsonResponse
    {
        $application = AccountRoleHistory::findOrFail($id);

        try {
            $this->transitions->approve($application, $request->user());

            return response()->json([
                'success' => true,
                'message' => "Role application approved. User is now a {$application->requested_role}.",
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * PATCH /api/v1/admin/role-applications/{id}/reject
     * Reject a pending application with a reason.
     */
    public function reject(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:1000'],
        ]);

        $application = AccountRoleHistory::findOrFail($id);

        try {
            $this->transitions->reject($application, $request->user(), $validated['reason']);

            return response()->json([
                'success' => true,
                'message' => 'Application rejected.',
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * GET /api/v1/admin/role-applications/stats
     * Summary counts per status for the admin dashboard.
     */
    public function stats(): JsonResponse
    {
        $stats = AccountRoleHistory::selectRaw('status, requested_role, count(*) as total')
            ->groupBy('status', 'requested_role')
            ->get();

        return response()->json(['stats' => $stats]);
    }
}
