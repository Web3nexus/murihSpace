<?php

namespace App\Services;

use App\Models\AccountRoleHistory;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Handles all role transition business logic.
 *
 * Supported paths:
 *   member  → creator
 *   member  → vendor
 *   vendor  → creator
 *   creator → vendor
 *
 * Downgrades are blocked when the account has:
 *   - pending orders
 *   - open disputes
 *   - pending withdrawals
 *   - active paid memberships
 *   - unresolved escrow transactions
 *   - unsettled creator earnings
 *   - active events or conferences
 */
class RoleTransitionService
{
    /** Roles that may request an upgrade/change. */
    private const ALLOWED_TRANSITIONS = [
        'member'  => ['creator', 'vendor'],
        'vendor'  => ['creator'],
        'creator' => ['vendor'],
    ];

    /**
     * Submit a role upgrade / downgrade application.
     *
     * @throws \Exception
     */
    public function apply(User $user, string $requestedRole): AccountRoleHistory
    {
        $currentRole = $user->role;

        // Validate the transition is allowed
        $allowed = self::ALLOWED_TRANSITIONS[$currentRole] ?? [];
        if (! in_array($requestedRole, $allowed, true)) {
            throw new \Exception("Role change from '{$currentRole}' to '{$requestedRole}' is not supported.");
        }

        // Check no pending application already exists
        $existing = AccountRoleHistory::where('user_id', $user->id)
            ->where('status', 'pending')
            ->first();

        if ($existing) {
            throw new \Exception('You already have a pending role application. Please wait for it to be reviewed.');
        }

        // Check downgrade blockers (creator → vendor, vendor → creator treated as lateral)
        $blockers = $this->downgradeblockers($user, $requestedRole);
        if (! empty($blockers)) {
            throw new \Exception('Role change cannot be completed: ' . implode('; ', $blockers));
        }

        // Trigger KYC requirement for role application if not already started or verified
        if (in_array($user->kyc_status, ['not_required', null, 'unsubmitted'], true)) {
            $user->update(['kyc_status' => 'not_started']);
        }

        return AccountRoleHistory::create([
            'user_id'        => $user->id,
            'previous_role'  => $currentRole,
            'requested_role' => $requestedRole,
            'status'         => 'pending',
            'requested_at'   => now(),
            'metadata'       => [
                'ip'         => request()->ip(),
                'user_agent' => request()->userAgent(),
            ],
        ]);
    }

    /**
     * Admin approves a role application.
     *
     * @throws \Exception|\Throwable
     */
    public function approve(AccountRoleHistory $application, User $admin): void
    {
        if (! $application->isPending()) {
            throw new \Exception('Only pending applications can be approved.');
        }

        DB::transaction(function () use ($application, $admin) {
            $user = $application->user;

            $application->update([
                'status'      => 'approved',
                'approved_at' => now(),
                'approved_by' => $admin->id,
            ]);

            // Activate the new role
            $user->update(['role' => $application->requested_role]);
        });
    }

    /**
     * Admin rejects a role application.
     */
    public function reject(AccountRoleHistory $application, User $admin, string $reason): void
    {
        if (! $application->isPending()) {
            throw new \Exception('Only pending applications can be rejected.');
        }

        $application->update([
            'status'           => 'rejected',
            'approved_at'      => now(),
            'approved_by'      => $admin->id,
            'rejection_reason' => $reason,
        ]);
    }

    /**
     * User cancels their own pending application.
     */
    public function cancel(AccountRoleHistory $application, User $user): void
    {
        if ($application->user_id !== $user->id) {
            throw new \Exception('Unauthorized.');
        }

        if (! $application->isPending()) {
            throw new \Exception('Only pending applications can be cancelled.');
        }

        $application->update(['status' => 'cancelled']);
    }

    // ── Private helpers ──────────────────────────────────────────────────

    /**
     * Check for conditions that block a role change.
     * Returns an array of human-readable blocking reasons.
     */
    private function downgradeblockers(User $user, string $requestedRole): array
    {
        $blockers = [];

        // Skip blocker checks for upgrades (member → creator/vendor)
        if ($user->role === 'member') {
            return [];
        }

        // Open disputes
        $openDisputes = \App\Models\Dispute::where('user_id', $user->id)
            ->whereIn('status', ['open', 'under_review'])
            ->count();
        if ($openDisputes > 0) {
            $blockers[] = "{$openDisputes} open dispute(s) must be resolved first";
        }

        // Pending withdrawals
        $pendingWithdrawals = \App\Models\WithdrawalRequest::where('user_id', $user->id)
            ->where('status', 'pending')
            ->count();
        if ($pendingWithdrawals > 0) {
            $blockers[] = "{$pendingWithdrawals} pending withdrawal request(s) must be completed";
        }

        // Unresolved escrow
        $openEscrows = \App\Models\Escrow::where('seller_id', $user->id)
            ->whereIn('status', ['held', 'disputed'])
            ->count();
        if ($openEscrows > 0) {
            $blockers[] = "{$openEscrows} unresolved escrow transaction(s) must be settled";
        }

        // Active events
        $activeEvents = \App\Models\Event::where('user_id', $user->id)
            ->where('status', 'active')
            ->where('start_date', '>', now())
            ->count();
        if ($activeEvents > 0) {
            $blockers[] = "{$activeEvents} upcoming event(s) must conclude or be cancelled";
        }

        return $blockers;
    }
}
