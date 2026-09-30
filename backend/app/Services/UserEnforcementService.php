<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Models\UserWarning;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * The single place member standing is changed.
 *
 * Both the administration console and the internal service API call this, so
 * the ban gate in DEC-012 cannot be bypassed by using one front door instead of
 * the other.
 */
class UserEnforcementService
{
    public const BAN_TYPES = ['standard', 'emergency'];

    public function __construct(private readonly NotificationService $notifications) {}

    /**
     * The most recent warning that still counts toward the ban gate.
     */
    public function activeWarning(User $user): ?UserWarning
    {
        return $user->warnings()
            ->whereNull('revoked_at')
            ->whereNull('ban_id')
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->latest('issued_at')
            ->latest('id')
            ->first();
    }

    public function canBan(User $user): bool
    {
        return $this->activeWarning($user) !== null;
    }

    public function warn(
        User $actor,
        User $target,
        string $reason,
        string $category = 'conduct',
        ?int $validForDays = 30,
    ): UserWarning {
        $warning = $target->warnings()->create([
            'issued_by' => $actor->id,
            'reason' => $reason,
            'category' => $category,
            'expires_at' => $validForDays === null ? null : now()->addDays($validForDays),
        ]);

        AuditLog::create([
            'user_id' => $actor->id,
            'action' => 'user.warned',
            'resource_type' => 'user',
            'resource_id' => (string) $target->id,
            'metadata' => [
                'reason' => $reason,
                'category' => $category,
                'expires_at' => $warning->expires_at?->toIso8601String(),
                'warning_id' => $warning->id,
            ],
        ]);

        try {
            $this->notifications->actionEmail(
                user: $target,
                title: 'Warning: your activity violates our community rules',
                bodyHtml: '<p>We have identified activity on your account that violates our community guidelines.</p>'
                    .'<p><strong>Reason:</strong> '.e($reason).'</p>'
                    .'<p>Please review the community guidelines. Continued violations may result in your account being suspended or banned.</p>',
                footnote: 'If you believe this is a mistake, reply to this message and our support team will review it.',
                template: 'user_warned',
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return $warning;
    }

    public function revokeWarning(User $actor, User $target, int $warningId, ?string $reason = null): UserWarning
    {
        $warning = $target->warnings()->whereKey($warningId)->firstOrFail();

        $warning->update([
            'revoked_at' => now(),
            'revoked_by' => $actor->id,
        ]);

        AuditLog::create([
            'user_id' => $actor->id,
            'action' => 'user.warning_revoked',
            'resource_type' => 'user',
            'resource_id' => (string) $target->id,
            'metadata' => ['warning_id' => $warning->id, 'reason' => $reason],
        ]);

        return $warning;
    }

    /**
     * @throws RuntimeException when the ban gate is not satisfied
     */
    public function ban(User $actor, User $target, string $reason, string $banType = 'standard'): User
    {
        if (! in_array($banType, self::BAN_TYPES, true)) {
            throw new RuntimeException("Unknown ban type [{$banType}].");
        }

        $warning = $this->activeWarning($target);

        if ($warning === null && $banType === 'standard') {
            throw new \App\Exceptions\BanGateException(
                'This member has no active warning on record. Issue a warning first, or record this as an emergency ban.'
            );
        }

        return DB::transaction(function () use ($actor, $target, $reason, $banType, $warning) {
            $target->update([
                'status' => 'banned',
                'suspended_at' => now(),
                'suspension_reason' => $reason,
            ]);

            $auditLog = AuditLog::create([
                'user_id' => $actor->id,
                'action' => 'user.banned',
                'resource_type' => 'user',
                'resource_id' => (string) $target->id,
                'metadata' => [
                    'reason' => $reason,
                    'ban_type' => $banType,
                    'warning_id' => $warning?->id,
                ],
            ]);

            if ($warning !== null && $warning->ban_id === null) {
                $warning->update(['ban_id' => (string) $auditLog->id]);
            }

            return $target->refresh();
        });
    }

    public function suspend(User $actor, User $target, string $reason): User
    {
        $target->update([
            'status' => 'suspended',
            'suspended_at' => now(),
            'suspension_reason' => $reason,
        ]);

        AuditLog::create([
            'user_id' => $actor->id,
            'action' => 'user.suspended',
            'resource_type' => 'user',
            'resource_id' => (string) $target->id,
            'metadata' => ['reason' => $reason],
        ]);

        return $target->refresh();
    }

    /**
     * Whole days left before the warning lapses. Rounded up, so a warning
     * issued today to last 30 days reads as 30 rather than 29 for the whole of
     * its first day.
     */
    public function daysRemaining(UserWarning $warning): ?int
    {
        if ($warning->expires_at === null) {
            return null;
        }

        return max(0, (int) ceil(Carbon::now()->diffInDays($warning->expires_at, false)));
    }
}
