<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KycVerification extends Model
{
    protected $fillable = [
        'user_id',
        'provider',
        'status',
        'provider_session_id',
        'started_at',
        'completed_at',
        'expires_at',
        'rejection_reason',
        'rejection_code',
        'provider_metadata',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'expires_at' => 'datetime',
        'provider_metadata' => 'array',
    ];

    public const STATUSES = ['pending', 'verified', 'rejected', 'expired'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isVerified(): bool
    {
        return $this->status === 'verified';
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }
}
