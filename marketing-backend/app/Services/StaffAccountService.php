<?php

namespace App\Services;

use App\Jobs\SyncStaffAccountJob;
use App\Models\AuditLog;
use App\Models\StaffUser;
use Illuminate\Support\Arr;

/**
 * Create, update, disable and re-enable staff accounts. Every change is audited
 * and queued for sync to the main backend. Secrets never enter audit snapshots.
 */
class StaffAccountService
{
    public function __construct(
        protected AuditLogService $audit,
    ) {}

    /**
     * @param  array{name:string, email:string, role:string, password:string, permissions?:?array}  $data
     */
    public function create(array $data, StaffUser $actor): StaffUser
    {
        $staff = StaffUser::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'role' => $data['role'],
            'password' => $data['password'],
            'permissions' => $data['permissions'] ?? null,
            'status' => StaffUser::STATUS_ACTIVE,
        ]);

        $this->audit->record(AuditLog::STAFF_ACCOUNT_CREATE, actor: $actor, subject: $staff, after: $this->snapshot($staff));
        SyncStaffAccountJob::dispatch($staff->id);

        return $staff;
    }

    /**
     * @param  array<string, mixed>  $data  name, email, role, permissions, password (optional reset)
     */
    public function update(StaffUser $staff, array $data, StaffUser $actor): StaffUser
    {
        $before = $this->snapshot($staff);

        $attributes = Arr::only($data, ['name', 'email', 'role', 'permissions']);
        $passwordReset = ! empty($data['password']);
        if ($passwordReset) {
            $attributes['password'] = $data['password'];
        }

        $staff->fill($attributes);
        $dirty = $staff->isDirty();
        $staff->save();

        if ($passwordReset) {
            // A reset must not leave old sessions or tokens usable.
            $staff->tokens()->delete();
        }

        if (! $dirty) {
            return $staff;
        }

        $this->audit->record(
            AuditLog::STAFF_ACCOUNT_UPDATE,
            actor: $actor,
            subject: $staff,
            before: $before,
            after: $this->snapshot($staff),
            metadata: $passwordReset ? ['password_reset' => true] : null,
        );
        SyncStaffAccountJob::dispatch($staff->id);

        return $staff;
    }

    public function disable(StaffUser $staff, StaffUser $actor): StaffUser
    {
        $before = $this->snapshot($staff);

        $staff->forceFill(['status' => StaffUser::STATUS_DISABLED])->save();
        $staff->tokens()->delete();

        $this->audit->record(
            AuditLog::STAFF_ACCOUNT_DISABLE,
            actor: $actor,
            subject: $staff,
            before: $before,
            after: $this->snapshot($staff),
        );
        SyncStaffAccountJob::dispatch($staff->id);

        return $staff;
    }

    public function enable(StaffUser $staff, StaffUser $actor): StaffUser
    {
        $before = $this->snapshot($staff);

        $staff->forceFill([
            'status' => StaffUser::STATUS_ACTIVE,
            'failed_login_attempts' => 0,
            'locked_until' => null,
        ])->save();

        $this->audit->record(
            AuditLog::STAFF_ACCOUNT_ENABLE,
            actor: $actor,
            subject: $staff,
            before: $before,
            after: $this->snapshot($staff),
        );
        SyncStaffAccountJob::dispatch($staff->id);

        return $staff;
    }

    /**
     * @return array{name:string, email:string, role:string, status:string, permissions:?array}
     */
    public function snapshot(StaffUser $staff): array
    {
        return [
            'name' => $staff->name,
            'email' => $staff->email,
            'role' => $staff->role,
            'status' => $staff->status,
            'permissions' => $staff->permissions,
        ];
    }
}
