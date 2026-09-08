<?php

namespace App\Models;

use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Payment extends Model
{
    protected $fillable = [
        'public_reference',
        'internal_reference',
        'provider',
        'provider_transaction_id',
        'provider_reference',
        'customer_id',
        'user_id',
        'business_id',
        'transaction_type',
        'payment_method',
        'amount',
        'currency',
        'fees',
        'net_amount',
        'status',
        'failure_reason',
        'metadata',
        'idempotency_key',
        'paid_at',
        'expires_at',
    ];

    protected $casts = [
        'amount' => 'integer',
        'fees' => 'integer',
        'net_amount' => 'integer',
        'status' => PaymentStatus::class,
        'metadata' => 'array',
        'paid_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $payment) {
            if (empty($payment->internal_reference)) {
                $payment->internal_reference = (string) Str::uuid();
            }
            if (empty($payment->public_reference)) {
                $payment->public_reference = 'PAY-' . strtoupper(now()->format('Ymd')) . '-' . strtoupper(Str::random(8));
            }
        });
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(PaymentAttempt::class, 'payment_id');
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class, 'payment_id');
    }

    public function isSuccessful(): bool
    {
        return $this->status === PaymentStatus::Successful;
    }

    public function getAmountInStandardUnits(): float
    {
        return round($this->amount / 100, 2);
    }
}

