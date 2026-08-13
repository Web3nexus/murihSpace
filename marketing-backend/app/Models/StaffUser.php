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

    protected $fillable = [
        'name', 'email', 'password', 'role', 'is_active', 'is_available',
        'permissions', 'last_login_at', 'last_login_ip',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'permissions' => 'array',
        'is_active' => 'boolean',
        'is_available' => 'boolean',
        'last_login_at' => 'datetime',
    ];

    public static function rolePermissions(string $role): array
    {
        return (array) config("staff.roles.{$role}", []);
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
        if ($this->isAdmin()) {
            return ['*'];
        }

        return $this->permissions ?? static::rolePermissions($this->role);
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isAdmin()) {
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
