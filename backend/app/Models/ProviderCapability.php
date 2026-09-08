<?php

namespace App\Models;

use App\Enums\CapabilityStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderCapability extends Model
{
    protected $fillable = [
        'payment_provider_id',
        'capability',
        'country_code',
        'currency',
        'status',
        'min_amount',
        'max_amount',
        'approval_requirements',
    ];

    protected $casts = [
        'status' => CapabilityStatus::class,
        'min_amount' => 'integer',
        'max_amount' => 'integer',
        'approval_requirements' => 'array',
    ];

    public function provider(): BelongsTo
    {
        return $this->belongsTo(PaymentProvider::class, 'payment_provider_id');
    }
}

