<?php

namespace App\Models;

use App\Enums\PayoutStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Payout extends Model
{
    protected $fillable = [
        'public_reference',
        'internal_reference',
        'user_id',
        'business_id',
        'payout_destination_id',
        'amount',
        'currency',
        'fee_amount',
        'net_amount',
        'provider',
        'provider_payout_id',
        'provider_reference',
        'status',
        'failure_reason',
        'idempotency_key',
        'dispatched_at',
        'completed_at',
    ];

    protected $casts = [
        'amount' => 'integer',
        'fee_amount' => 'integer',
        'net_amount' => 'integer',
        'status' => PayoutStatus::class,
        'dispatched_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $payout) {
            if (empty($payout->internal_reference)) {
                $payout->internal_reference = (string) Str::uuid();
            }
            if (empty($payout->public_reference)) {
                $payout->public_reference = 'PO-' . strtoupper(now()->format('Ymd')) . '-' . strtoupper(Str::random(8));
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function destination(): BelongsTo
    {
        return $this->belongsTo(PayoutDestination::class, 'payout_destination_id');
    }
}

