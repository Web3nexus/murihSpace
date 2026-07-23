<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentWebhook extends Model
{
    protected $fillable = [
        'provider',
        'event_id',
        'event_type',
        'payload',
        'status',
    ];

    protected $casts = [
        'payload' => 'array',
    ];
}
