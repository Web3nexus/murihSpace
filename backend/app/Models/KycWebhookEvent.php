<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KycWebhookEvent extends Model
{
    protected $fillable = [
        'provider',
        'provider_event_id',
        'provider_session_id',
        'type',
        'status',
        'processing_status',
        'raw_payload',
        'received_at',
        'processed_at',
        'processing_error',
    ];

    protected $casts = [
        'raw_payload' => 'array',
        'received_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    public const PROCESSING_STATUSES = ['pending', 'processing', 'processed', 'failed', 'ignored'];
}
