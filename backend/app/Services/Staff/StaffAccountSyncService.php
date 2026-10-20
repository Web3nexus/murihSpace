<?php

namespace App\Services\Staff;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Keeps the administrator accounts on this backend in step with the staff records
 * owned by the marketing backend. Accounts are keyed on the staff identity id, never
 * on email, so a staff member is one account here however their email changes.
 */
class StaffAccountSyncService
{
    public const STATUS_CREATED = 'created';
    public const STATUS_UPDATED = 'updated';
    public const STATUS_CONFLICT = 'conflict';
    public const STATUS_NOT_FOUND = 'not_found';

    /**
     * @param  array{staff_identity_id: string, email: string, name: string, role: string, status: string, permissions: array<int, string>}  $record
     * @return array{status: string, user?: User}
     */
    public function upsert(array $record, ?string $ipAddress = null, ?string $userAgent = null): array
    {
        $disabled = $record['status'] === 'disabled';

        return DB::transaction(function () use ($record, $disabled, $ipAddress, $userAgent) {
            $user = User::withTrashed()->where('staff_identity_id', $record['staff_identity_id'])->first();

            // An existing consumer account with this email is never adopted as staff.
            // Doing so would hand it administrator rights on the strength of an email alone.
            $emailOwner = User::withTrashed()->where('email', $record['email'])->first();
            if ($emailOwner && (! $user || $emailOwner->id !== $user->id)) {
                return ['status' => self::STATUS_CONFLICT];
            }

            $created = $user === null;
            $user ??= new User();

            $user->forceFill([
                'staff_identity_id' => $record['staff_identity_id'],
                'name' => $record['name'],
                'email' => $record['email'],
                'role' => 'admin',
                'admin_role' => $record['role'],
                'admin_permissions' => array_values(array_unique($record['permissions'])),
                'status' => $disabled ? 'suspended' : 'active',
                'suspended_at' => $disabled ? ($user->suspended_at ?? now()) : null,
                'suspension_reason' => $disabled ? 'Staff access removed in the marketing backend.' : null,
            ]);

            if ($created) {
                $user->email_verified_at = now();
            }

            if ($user->isDirty() || ! $user->exists) {
                $user->save();
            }

            if ($user->trashed()) {
                $user->restore();
            }

            if ($disabled) {
                $user->tokens()->delete();
            }

            AuditLog::create([
                'user_id' => null,
                'action' => $created ? 'admin.created' : 'admin.updated',
                'resource_type' => 'user',
                'resource_id' => (string) $user->id,
                'metadata' => [
                    'source' => 'staff_sync',
                    'staff_identity_id' => $record['staff_identity_id'],
                    'admin_role' => $record['role'],
                    'admin_permissions' => $user->admin_permissions,
                    'status' => $user->status,
                ],
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
            ]);

            return ['status' => $created ? self::STATUS_CREATED : self::STATUS_UPDATED, 'user' => $user];
        });
    }

    /**
     * Disable-only path. Removing a staff member here never deletes the account, so its
     * history stays attributable. Calling it again is harmless.
     *
     * @return array{status: string, user?: User}
     */
    public function disable(string $staffIdentityId, ?string $ipAddress = null, ?string $userAgent = null): array
    {
        return DB::transaction(function () use ($staffIdentityId, $ipAddress, $userAgent) {
            $user = User::withTrashed()->where('staff_identity_id', $staffIdentityId)->first();

            if (! $user) {
                return ['status' => self::STATUS_NOT_FOUND];
            }

            if ($user->status !== 'suspended' || $user->trashed()) {
                $user->forceFill([
                    'status' => 'suspended',
                    'suspended_at' => $user->suspended_at ?? now(),
                    'suspension_reason' => 'Staff access removed in the marketing backend.',
                ])->save();
            }

            if ($user->trashed()) {
                $user->restore();
            }

            $user->tokens()->delete();

            AuditLog::create([
                'user_id' => null,
                'action' => 'admin.updated',
                'resource_type' => 'user',
                'resource_id' => (string) $user->id,
                'metadata' => [
                    'source' => 'staff_sync',
                    'staff_identity_id' => $staffIdentityId,
                    'status' => 'suspended',
                ],
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
            ]);

            return ['status' => self::STATUS_UPDATED, 'user' => $user];
        });
    }
}
