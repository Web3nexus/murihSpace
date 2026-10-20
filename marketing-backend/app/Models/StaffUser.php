<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class StaffUser extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_DISABLED = 'disabled';

    public const ROLE_SUPER_ADMIN = 'super_admin';

    protected $fillable = [
        'name', 'email', 'password', 'role', 'status', 'is_active', 'is_available',
        'permissions', 'last_login_at', 'last_login_ip',
    ];

    protected $hidden = ['password', 'remember_token', 'two_factor_secret'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'permissions' => 'array',
        'is_active' => 'boolean',
        'is_available' => 'boolean',
        'last_login_at' => 'datetime',
        'two_factor_secret' => 'encrypted',
        'two_factor_confirmed_at' => 'datetime',
        'locked_until' => 'datetime',
    ];

    protected static function booted(): void
    {
        // status is the source of truth for new code; is_active is kept in step
        // so existing SecureCRM queries keep working.
        static::saving(function (StaffUser $staff) {
            if ($staff->isDirty('is_active') && ! $staff->isDirty('status')) {
                $staff->status = $staff->is_active ? self::STATUS_ACTIVE : self::STATUS_DISABLED;
            }

            $staff->is_active = $staff->status === self::STATUS_ACTIVE;
        });
    }

    public static function rolePermissions(string $role): array
    {
        return (array) config("staff.roles.{$role}", []);
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isLocked(): bool
    {
        return $this->locked_until !== null && $this->locked_until->isFuture();
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === self::ROLE_SUPER_ADMIN;
    }

    public function hasTwoFactor(): bool
    {
        return $this->two_factor_confirmed_at !== null && $this->two_factor_secret !== null;
    }

    public function isAdmin(): bool
    {
        return $this->role === 'support_admin';
    }

    /**
     * Teams this staff member belongs to.
     */
    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(SupportTeam::class, 'support_team_member')
            ->withPivot('is_lead')
            ->withTimestamps();
    }

    /**
     * Whether this agent is currently taking new ticket assignments.
     */
    public function isTakingAssignments(): bool
    {
        return $this->is_active && $this->is_available;
    }

    /**
     * Effective permission list for this staff member.
     * A custom "permissions" list overrides the role defaults.
     */
    public function allPermissions(): array
    {
        if ($this->isAdmin() || $this->isSuperAdmin()) {
            return ['*'];
        }

        return $this->permissions ?? static::rolePermissions($this->role);
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isAdmin() || $this->isSuperAdmin()) {
            return true;
        }

        return in_array($permission, $this->allPermissions(), true);
    }

    /**
     * Whether this staff member may view a SecureCRM section.
     */
    public function canAccessSection(string $section): bool
    {
        $permission = config("staff.section_permissions.{$section}");

        if ($permission === null) {
            return $this->isAdmin();
        }

        return $this->hasPermission($permission);
    }
}
