<?php

namespace App\Models;

use App\Enums\RefundStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Refund extends Model
{
    protected $fillable = [
        'public_reference',
        'internal_reference',
        'payment_id',
        'amount',
        'currency',
        'reason',
        'provider',
        'provider_refund_id',
        'status',
        'failure_reason',
        'idempotency_key',
    ];

    protected $casts = [
        'amount' => 'integer',
        'status' => RefundStatus::class,
    ];

    protected static function booted(): void
    {
        static::creating(function (self $refund) {
            if (empty($refund->internal_reference)) {
                $refund->internal_reference = (string) Str::uuid();
            }
            if (empty($refund->public_reference)) {
                $refund->public_reference = 'REF-' . strtoupper(now()->format('Ymd')) . '-' . strtoupper(Str::random(8));
            }
        });
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}

