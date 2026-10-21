<?php

namespace App\Http\Controllers;

use App\Http\Middleware\EnsureImpersonationLiveness;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\UserWarning;
use App\Services\NotificationService;
use App\Services\UserEnforcementService;
use App\Support\ImpersonationSession;
use App\Support\WebSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class AdminUserController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly UserEnforcementService $enforcement,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', 'in:member,creator,vendor,admin'],
            'status' => ['nullable', 'string', 'in:active,suspended,banned,deleted'],
            'kyc' => ['nullable', 'string', 'in:pending,verified,rejected'],
            'sort' => ['nullable', 'string', 'in:name,email,username,role,status,kyc_status,created_at,deleted_at'],
            'sort_dir' => ['nullable', 'string', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $query = User::withTrashed()->select([
            'id', 'name', 'email', 'username', 'role', 'status',
            'kyc_status', 'created_at', 'suspended_at', 'deleted_at', 'mobile_number', 'country',
        ])->where('role', '!=', 'admin');

        if (! empty($validated['search'])) {
            $s = $validated['search'];
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%")
                    ->orWhere('username', 'like', "%{$s}%")
                    ->orWhere('mobile_number', 'like', "%{$s}%");
            });
        }
        if (! empty($validated['role'])) {
            $query->where('role', $validated['role']);
        }
        if (! empty($validated['status'])) {
            if ($validated['status'] === 'deleted') {
                $query->where(function ($q) {
                    $q->whereNotNull('deleted_at')->orWhere('status', 'deleted');
                });
            } else {
                $query->whereNull('deleted_at')->where('status', $validated['status']);
            }
        }
        if (! empty($validated['kyc'])) {
            $query->where('kyc_status', $validated['kyc']);
        }

        $sortField = $validated['sort'] ?? 'created_at';
        $sortDir = $validated['sort_dir'] ?? 'desc';
        $query->orderBy($sortField, $sortDir);

        // Contact details are visible only inside the user-management routes, which
        // are already gated by the `users` admin permission.
        $page = $query->paginate($validated['per_page'] ?? 20);
        $page->getCollection()->each(fn (User $u) => $u->makeVisible(['email', 'mobile_number']));

        return response()->json($page);
    }

    public function show(int $id): JsonResponse
    {
        $user = User::withTrashed()->select([
            'id', 'name', 'email', 'username', 'role', 'status',
            'kyc_status', 'kyc_rejection_reason', 'country', 'mobile_number',
            'created_at', 'suspended_at', 'suspension_reason', 'deleted_at',
            'email_verified_at',
        ])->findOrFail($id);

        // Fetch financial and compliance tracking record for legal & regulatory audits
        $wallets = \App\Models\Wallet::where('user_id', $id)->get();
        $ordersCount = \App\Models\Order::where('buyer_id', $id)->orWhere('seller_id', $id)->count();
        $ledgerCount = \App\Models\LedgerTransaction::where('user_id', $id)->count();
        $disputesCount = \App\Models\Dispute::where('raised_by', $id)
            ->orWhereHas('escrow', function ($q) use ($id) {
                $q->where('buyer_id', $id)->orWhere('seller_id', $id);
            })->count();
        $kycRecord = \App\Models\KycVerification::where('user_id', $id)->latest()->first();

        $user->makeVisible(['email', 'mobile_number']);

        return response()->json([
            'data' => $user,
            'financial_summary' => [
                'wallets' => $wallets,
                'orders_count' => $ordersCount,
                'ledger_count' => $ledgerCount,
                'disputes_count' => $disputesCount,
            ],
            'kyc_record' => $kycRecord,
        ]);
    }

    public function suspend(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $user = User::withTrashed()->findOrFail($id);
        $this->enforcement->suspend($request->user(), $user, $validated['reason']);

        try {
            $this->notifications->actionEmail(
                user: $user,
                title: 'Your account has been suspended',
                bodyHtml: '<p>Your MurihSpace account has been <strong>suspended</strong> while we review your activity. During this time you will not be able to access your account.</p>',
                footnote: 'If you believe this is a mistake, please contact support.',
                template: 'user_suspended',
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json(['message' => 'User suspended.', 'data' => $user]);
    }

    public function activate(Request $request, int $id): JsonResponse
    {
        $user = User::withTrashed()->findOrFail($id);
        $user->update([
            'status' => 'active',
            'suspended_at' => null,
            'suspension_reason' => null,
        ]);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'user.activated',
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
        ]);

        try {
            $this->notifications->actionEmail(
                user: $user,
                title: 'Your account has been reactivated',
                bodyHtml: '<p>Great news — your MurihSpace account has been <strong>reactivated</strong>. You can sign in and use the platform normally again.</p>',
                actionLabel: 'Sign in',
                actionUrl: NotificationService::link('login'),
                template: 'user_reactivated',
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json(['message' => 'User activated.', 'data' => $user]);
    }

    public function export(Request $request): \Illuminate\Http\Response
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', 'in:member,creator,vendor,admin'],
            'status' => ['nullable', 'string', 'in:active,suspended,banned,deleted'],
            'kyc' => ['nullable', 'string', 'in:pending,verified,rejected'],
            'sort' => ['nullable', 'string', 'in:name,email,username,role,status,kyc_status,created_at,deleted_at'],
            'sort_dir' => ['nullable', 'string', 'in:asc,desc'],
        ]);

        $query = User::withTrashed()->select(['name', 'email', 'username', 'role', 'status', 'kyc_status', 'created_at', 'deleted_at'])
            ->where('role', '!=', 'admin');

        if (! empty($validated['search'])) {
            $s = $validated['search'];
            $query->where(fn($q) => $q->where('name', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")
                ->orWhere('username', 'like', "%{$s}%"));
        }
        if (! empty($validated['role'])) $query->where('role', $validated['role']);
        if (! empty($validated['status'])) {
            if ($validated['status'] === 'deleted') {
                $query->where(function ($q) {
                    $q->whereNotNull('deleted_at')->orWhere('status', 'deleted');
                });
            } else {
                $query->whereNull('deleted_at')->where('status', $validated['status']);
            }
        }
        if (! empty($validated['kyc'])) $query->where('kyc_status', $validated['kyc']);

        $sortField = $validated['sort'] ?? 'created_at';
        $sortDir = $validated['sort_dir'] ?? 'desc';
        $query->orderBy($sortField, $sortDir);

        $csv = \League\Csv\Writer::createFromString('');
        $csv->insertOne(['Name', 'Email', 'Username', 'Role', 'Status', 'KYC Status', 'Joined', 'Deleted At']);
        $csv->insertAll($query->cursor()->map(fn($u) => [
            $u->name, $u->email, $u->username, $u->role, $u->trashed() ? 'deleted' : $u->status, $u->kyc_status, $u->created_at?->toDateString(), $u->deleted_at?->toDateTimeString(),
        ])->toArray());

        return response($csv->toString(), 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="users-export.csv"',
        ]);
    }

    public function ban(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
            'ban_type' => ['nullable', 'string', 'in:standard,emergency'],
        ]);

        $user = User::withTrashed()->findOrFail($id);
        $banType = $validated['ban_type'] ?? 'standard';

        try {
            $this->enforcement->ban($request->user(), $user, $validated['reason'], $banType);
        } catch (\App\Exceptions\BanGateException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'warning_required',
            ], 422);
        }

        try {
            $this->notifications->actionEmail(
                user: $user,
                title: 'Your account has been banned',
                bodyHtml: '<p>Your MurihSpace account has been <strong>banned</strong> due to a violation of our terms of service. This decision is final.</p>',
                footnote: 'If you believe this decision is in error, you may contact our support team.',
                template: 'user_banned',
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'message' => 'User banned.',
            'data' => $user->refresh(),
        ]);
    }

    /**
     * GET /admin/users/{id}/warnings
     */
    public function warnings(int $id): JsonResponse
    {
        $user = User::withTrashed()->findOrFail($id);

        $warnings = $user->warnings()
            ->with('issuer:id,name')
            ->latest('issued_at')
            ->latest('id')
            ->limit(50)
            ->get()
            ->map(fn (UserWarning $warning) => [
                'id' => $warning->id,
                'reason' => $warning->reason,
                'category' => $warning->category,
                'issued_at' => $warning->issued_at?->toIso8601String(),
                'expires_at' => $warning->expires_at?->toIso8601String(),
                'days_remaining' => $this->enforcement->daysRemaining($warning),
                'active' => $warning->isActive(),
                'revoked_at' => $warning->revoked_at?->toIso8601String(),
                'issued_by' => $warning->issuer?->name,
            ]);

        return response()->json([
            'data' => $warnings,
            'meta' => [
                'can_ban' => $this->enforcement->canBan($user),
                'active_warning' => $this->enforcement->activeWarning($user)?->id,
            ],
        ]);
    }

    /**
     * POST /admin/users/{id}/warn
     */
    public function warn(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
            'category' => ['nullable', 'string', 'in:'.implode(',', UserWarning::CATEGORIES)],
            'valid_for_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $user = User::withTrashed()->findOrFail($id);

        $warning = $this->enforcement->warn(
            actor: $request->user(),
            target: $user,
            reason: $validated['reason'],
            category: $validated['category'] ?? 'conduct',
            validForDays: $validated['valid_for_days'] ?? 30,
        );

        return response()->json([
            'message' => 'Warning issued.',
            'data' => $warning,
        ], 201);
    }

    /**
     * DELETE /admin/users/{id}/warnings/{warning}
     */
    public function revokeWarning(Request $request, int $id, int $warningId): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $user = User::withTrashed()->findOrFail($id);
        $warning = $this->enforcement->revokeWarning(
            actor: $request->user(),
            target: $user,
            warningId: $warningId,
            reason: $validated['reason'] ?? null,
        );

        return response()->json([
            'message' => 'Warning revoked.',
            'data' => $warning,
        ]);
    }

    public function restore(Request $request, int $id): JsonResponse
    {
        $user = User::withTrashed()->findOrFail($id);

        if (! $user->trashed()) {
            return response()->json(['message' => 'Account is not deleted.'], 400);
        }

        $user->restore();
        $user->update([
            'status' => 'active',
            'suspended_at' => null,
            'suspension_reason' => null,
        ]);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'user.restored',
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
        ]);

        return response()->json([
            'message' => 'User account restored successfully.',
            'data' => $user,
        ]);
    }

    public function verifyKyc(Request $request, int $id): JsonResponse
    {
        $user = User::withTrashed()->findOrFail($id);

        $verification = $user->kyc_verification_id !== null
            ? \App\Models\KycVerification::find($user->kyc_verification_id)
            : $user->kycVerifications()->latest('id')->first();

        $provider = $verification?->provider ?? ($user->kyc_provider ?? 'manual');

        if ($verification !== null) {
            app(\App\Services\Kyc\KycService::class)->applyDecision($verification, \App\Enums\KycStatus::Verified->value);
        } else {
            $verification = app(\App\Services\Kyc\KycService::class)->createVerification($user, $provider);
            app(\App\Services\Kyc\KycService::class)->applyDecision($verification, \App\Enums\KycStatus::Verified->value);
        }

        $user->update([
            'kyc_status' => \App\Enums\KycStatus::Verified->value,
            'kyc_rejection_reason' => null,
            'kyc_provider' => $provider,
            'kyc_verification_id' => $verification->id,
        ]);

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'kyc.manually_verified',
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
            'metadata' => [
                'admin_id' => $request->user()->id,
                'admin_name' => $request->user()->name,
                'previous_status' => $user->getOriginal('kyc_status'),
                'new_status' => 'verified',
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => "User {$user->name} has been manually marked as KYC verified.",
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'kyc_status' => $user->fresh()->kyc_status,
            ],
        ]);
    }
}
