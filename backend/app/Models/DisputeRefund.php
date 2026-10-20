<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A buyer's refund after a dispute they won, held as balance until it is sent back to the card. */
class DisputeRefund extends Model
{
    protected $fillable = [
        'buyer_id', 'order_id', 'settlement_id', 'original_amount', 'original_currency',
        'amount_usd', 'status', 'provider_refund_id', 'failure_reason', 'refunded_at',
    ];

    protected $casts = [
        'original_amount' => 'decimal:2',
        'amount_usd' => 'integer',
        'refunded_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }
}
