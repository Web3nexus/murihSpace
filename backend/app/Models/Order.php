<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Order extends Model
{
    protected $fillable = [
        'order_number',
        'buyer_id',
        'creator_id',
        'product_id',
        'subtotal',
        'platform_fee',
        'total',
        'currency',
        'status',
        'payment_provider',
        'payment_intent_id',
        'idempotency_key',
        'paid_at',
    ];

    protected $casts = [
        'subtotal'     => 'decimal:2',
        'platform_fee' => 'decimal:2',
        'total'        => 'decimal:2',
        'paid_at'      => 'datetime',
    ];

    public const STATUSES = ['pending', 'processing', 'completed', 'failed', 'refunded'];

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(DigitalProduct::class, 'product_id');
    }
}
