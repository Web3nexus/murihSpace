<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CreatorQualificationEvent extends Model
{
    protected $fillable = [
        'user_id',
        'snapshot_id',
        'status',
        'scheduled_at',
        'notified_at',
        'expires_at',
        'metadata',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'notified_at'  => 'datetime',
        'expires_at'   => 'datetime',
        'metadata'     => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function snapshot(): BelongsTo
    {
        return $this->belongsTo(SocialFollowerSnapshot::class, 'snapshot_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isExpired(): bool
    {
        return $this->status === 'expired' ||
            ($this->expires_at && $this->expires_at->isPast());
    }
}
