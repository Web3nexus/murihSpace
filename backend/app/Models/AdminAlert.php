<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminAlert extends Model
{
    protected $fillable = [
        'event_type',
        'severity',
        'environment',
        'title',
        'description',
        'affected_service',
        'reference',
        'metadata',
        'channels',
        'requires_acknowledgement',
        'status',
        'acknowledged_at',
        'acknowledged_by',
        'acknowledgement_note',
    ];

    protected $casts = [
        'metadata' => 'array',
        'channels' => 'array',
        'requires_acknowledgement' => 'boolean',
        'acknowledged_at' => 'datetime',
    ];

    public function acknowledgedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }
}
