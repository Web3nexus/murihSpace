<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class FulfilmentOrder extends Model
{
    protected $fillable = [
        'buyer_id', 'shipping_address_id', 'order_number',
        'subtotal', 'shipping_cost', 'platform_fee', 'total', 'currency',
        'status', 'tracking_number', 'carrier',
        'estimated_delivery', 'shipped_at', 'delivered_at', 'notes',
    ];

    protected $casts = [
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        'estimated_delivery' => 'date:Y-m-d',
        'subtotal' => 'integer',
        'shipping_cost' => 'integer',
        'platform_fee' => 'integer',
        'total' => 'integer',
    ];

    public const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function shippingAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'shipping_address_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(FulfilmentOrderItem::class);
    }

    public function payout(): HasOne
    {
        return $this->hasOne(FulfilmentPayout::class);
    }

    public function escrow(): HasOne
    {
        return $this->hasOne(\App\Models\Escrow::class, 'fulfilment_order_id');
    }

    public function itemCount(): int
    {
        return $this->items->sum('quantity');
    }

    public function isShippable(): bool
    {
        return in_array($this->status, ['confirmed', 'processing']);
    }
}
