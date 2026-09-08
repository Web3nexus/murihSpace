<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderRoute extends Model
{
    protected $fillable = [
        'name',
        'transaction_type',
        'country_code',
        'currency',
        'payment_method',
        'primary_provider_id',
        'fallback_provider_id',
        'priority',
        'is_active',
        'conditions',
    ];

    protected $casts = [
        'priority' => 'integer',
        'is_active' => 'boolean',
        'conditions' => 'array',
    ];

    public function primaryProvider(): BelongsTo
    {
        return $this->belongsTo(PaymentProvider::class, 'primary_provider_id');
    }

    public function fallbackProvider(): BelongsTo
    {
        return $this->belongsTo(PaymentProvider::class, 'fallback_provider_id');
    }
}

