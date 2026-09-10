<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FxQuote extends Model
{
    protected $fillable = [
        'quote_reference',
        'source_currency',
        'destination_currency',
        'rate',
        'provider',
        'source_amount',
        'destination_amount',
        'fee',
        'markup',
        'expires_at',
        'executed_at',
    ];

    protected $casts = [
        'rate' => 'decimal:8',
        'source_amount' => 'integer',
        'destination_amount' => 'integer',
        'fee' => 'integer',
        'markup' => 'integer',
        'expires_at' => 'datetime',
        'executed_at' => 'datetime',
    ];

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }
}

