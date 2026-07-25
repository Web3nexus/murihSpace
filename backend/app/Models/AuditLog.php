<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id', 'action', 'resource_type', 'resource_id',
        'metadata', 'ip_address', 'user_agent',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public const ACTIONS = [
        'user.created', 'user.updated', 'user.suspended', 'user.activated', 'user.banned',
        'kyc.approved', 'kyc.rejected',
        'withdrawal.approved', 'withdrawal.rejected',
        'report.actioned', 'report.dismissed',
        'feature_flag.created', 'feature_flag.updated', 'feature_flag.deleted',
        'settings.updated',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
