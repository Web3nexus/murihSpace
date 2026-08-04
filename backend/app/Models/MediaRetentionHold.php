<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MediaRetentionHold extends Model
{
    protected $fillable = [
        'media_id',
        'hold_type',
        'reason',
        'case_ref',
        'placed_by',
        'expires_at',
        'status',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    public const TYPES = [
        'dispute',
        'order',
        'moderation',
        'legal',
        'reconciliation',
        'business_rule',
        'malware_review',
    ];

    public const STATUS_ACTIVE = 'active';
    public const STATUS_RELEASED = 'released';

    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class);
    }

    public function placedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'placed_by');
    }
}
