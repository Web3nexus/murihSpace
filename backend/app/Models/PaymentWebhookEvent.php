<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentWebhookEvent extends Model
{
    protected $fillable = [
        'provider',
        'provider_event_id',
        'event_type',
        'signature_verified',
        'payload_hash',
        'raw_payload_reference',
        'payload',
        'processing_status',
        'processed_at',
        'attempts',
        'error_message',
    ];

    protected $casts = [
        'signature_verified' => 'boolean',
        'payload' => 'array',
        'processed_at' => 'datetime',
        'attempts' => 'integer',
    ];
}

