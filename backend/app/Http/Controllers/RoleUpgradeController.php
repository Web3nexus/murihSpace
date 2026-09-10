<?php

namespace App\Http\Controllers;

use App\Models\AccountRoleHistory;
use App\Services\RoleTransitionService;
use App\Services\AdminAlertService;
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
     * Return the user's current pending (or latest) role application along with user KYC state.
     */
    public function myApplication(Request $request): JsonResponse
    {
        $user = $request->user();
        $application = AccountRoleHistory::where('user_id', $user->id)
            ->latest()
            ->first();

        return response()->json([
            'application' => $application,
            'user_kyc_status' => $user->kyc_status ?? 'not_required',
            'user_kyc_document' => $user->kyc_document,
            'kyc_requested' => (bool) ($application?->metadata['kyc_requested'] ?? false),
            'kyc_request_note' => $application?->metadata['kyc_request_note'] ?? null,
        ]);
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

            try {
                app(AdminAlertService::class)->dispatch([
                    'event_type' => 'role_application',
                    'severity' => 'warning',
                    'title' => 'New Role Application',
                    'description' => "User {$request->user()->name} has applied for the {$validated['requested_role']} role.",
                    'reference' => env('APP_URL') . '/app/securegate/role-applications',
                    'channels' => ['email', 'telegram']
                ]);
            } catch (\Throwable $e) {
                \Log::warning("Role upgrade admin alert dispatch failed: {$e->getMessage()}");
            }

            return response()->json([
                'success'     => true,
                'message'     => 'Your role application has been submitted successfully and is pending review.',
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
        $query = AccountRoleHistory::with([
            'user:id,name,email,role,avatar,kyc_status,kyc_document,kyc_provider,kyc_rejection_reason',
            'approvedBy:id,name',
        ])->latest();

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('role') && $request->input('role') !== 'all') {
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
        $application = AccountRoleHistory::with([
            'user:id,name,email,role,avatar,kyc_status,kyc_document,kyc_provider,kyc_rejection_reason',
            'approvedBy:id,name',
        ])->findOrFail($id);

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
     * PATCH /api/v1/admin/role-applications/{id}/request-kyc
     * Request KYC identity verification from the applicant before approval.
     */
    public function requestKyc(Request $request, int $id): JsonResponse
    {
        $application = AccountRoleHistory::with('user')->findOrFail($id);

        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $user = $application->user;
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Applicant user not found.'], 404);
        }

        // Update application metadata
        $metadata = is_array($application->metadata) ? $application->metadata : [];
        $metadata['kyc_requested'] = true;
        $metadata['kyc_requested_at'] = now()->toISOString();
        $metadata['kyc_request_note'] = $validated['note'] ?? 'Identity verification (KYC) is required for Creator/Vendor account approval.';

        $application->update([
            'metadata' => $metadata,
        ]);

        // If user KYC is not already verified or pending, set to not_started
        if (! in_array($user->kyc_status, ['verified', 'pending'], true)) {
            $user->update(['kyc_status' => 'not_started']);
        }

        // Notify user via Action Email & Official In-App Notification
        try {
            app(\App\Services\NotificationService::class)->actionEmail(
                user: $user,
                title: 'Identity Verification (KYC) Required for Creator Application',
                bodyHtml: '<p>Hi ' . htmlspecialchars($user->name) . ',</p><p>Our review team requires identity verification (KYC) to approve your application for the <strong>' . htmlspecialchars(ucfirst($application->requested_role)) . '</strong> role.</p><p>' . htmlspecialchars($metadata['kyc_request_note']) . '</p><p>Please log in and submit your KYC documents to continue.</p>',
                actionLabel: 'Submit KYC Verification',
                actionUrl: \App\Services\NotificationService::link('kyc'),
                template: 'kyc_requested',
            );

            $user->notify(new \App\Notifications\MurihOfficialNotification(
                type: 'kyc_requested',
                title: '🛡️ Identity Verification (KYC) Required',
                body: "Our review team requires KYC verification to approve your application for " . ucfirst($application->requested_role) . ": " . ($metadata['kyc_request_note'] ?? 'Please submit your government ID.'),
                actionUrl: \App\Services\NotificationService::link('kyc'),
                actionLabel: 'Submit KYC Now',
                route: '/kyc',
                metadata: [
                    'role' => $application->requested_role,
                    'note' => $metadata['kyc_request_note'],
                ]
            ));
        } catch (\Throwable $e) {
            \Log::warning("KYC request notification failed: {$e->getMessage()}");
        }

        // Create immutable audit log
        \App\Models\AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'role_application.kyc_requested',
            'resource_type' => 'account_role_history',
            'resource_id' => (string) $application->id,
            'metadata' => [
                'applicant_user_id' => $user->id,
                'requested_role' => $application->requested_role,
                'note' => $metadata['kyc_request_note'],
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => "KYC verification requested from {$user->name}. The applicant has been notified.",
            'application' => $application->fresh(['user', 'approvedBy']),
        ]);
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
