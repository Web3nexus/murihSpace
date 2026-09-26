<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $appends = [
        'admin_role',
        'admin_permissions',
    ];

    protected $fillable = [
        'user_id', 'action', 'resource_type', 'resource_id',
        'metadata', 'ip_address', 'user_agent',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public const ACTIONS = [
        // User lifecycle
        'user.created', 'user.updated', 'user.suspended', 'user.activated', 'user.banned',
        // KYC
        'kyc.approved', 'kyc.rejected',
        // Finance
        'withdrawal.approved', 'withdrawal.rejected',
        // Content
        'report.actioned', 'report.dismissed',
        // Feature flags & settings
        'feature_flag.created', 'feature_flag.updated', 'feature_flag.deleted',
        'settings.updated',
        // Admin management
        'admin.created', 'admin.updated', 'admin.removed',
        // Impersonation
        'user.impersonated', 'user.impersonation_stopped',
        'user.impersonation_timed_out', 'user.impersonation_revoked',
        // Commission & platform fees
        'commission.updated',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getAdminRoleAttribute(): ?string
    {
        return $this->metadata['admin_role']
            ?? $this->user?->admin_role
            ?? ($this->user?->role === 'admin' ? 'super_admin' : null);
    }

    public function getAdminPermissionsAttribute(): array
    {
        return $this->metadata['admin_permissions']
            ?? $this->user?->admin_permissions
            ?? [];
    }
}
