<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayoutDestination extends Model
{
    protected $fillable = [
        'user_id',
        'destination_type',
        'currency',
        'country_code',
        'bank_name',
        'bank_code',
        'account_number_masked',
        'account_name',
        'details_encrypted',
        'provider_recipient_codes',
        'is_default',
        'is_verified',
    ];

    protected $casts = [
        'details_encrypted' => 'encrypted:array',
        'provider_recipient_codes' => 'array',
        'is_default' => 'boolean',
        'is_verified' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(Payout::class);
    }
}

