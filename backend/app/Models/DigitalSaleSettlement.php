<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** The seller's share of a paid digital order, held for 48 hours and then released. */
class DigitalSaleSettlement extends Model
{
    public const STATUSES = ['pending', 'released', 'disputed', 'reversed'];

    protected $fillable = [
        'order_id', 'seller_id', 'buyer_id', 'order_currency', 'order_net_amount', 'fx_rate',
        'seller_fee_rate', 'seller_fee_usd', 'buyer_fee_usd',
        'gross_usd', 'credited_usd', 'held_usd', 'status', 'release_at', 'released_at',
        'disputed_at', 'dispute_source', 'dispute_outcome', 'provider_refund_required', 'resolved_at',
    ];

    protected $casts = [
        'order_net_amount' => 'decimal:2',
        'fx_rate' => 'float',
        'seller_fee_rate' => 'float',
        'seller_fee_usd' => 'integer',
        'buyer_fee_usd' => 'integer',
        'gross_usd' => 'integer',
        'credited_usd' => 'integer',
        'held_usd' => 'integer',
        'release_at' => 'datetime',
        'released_at' => 'datetime',
        'disputed_at' => 'datetime',
        'resolved_at' => 'datetime',
        'provider_refund_required' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::updated(function (DigitalSaleSettlement $settlement) {
            if ($settlement->wasChanged('status') && $settlement->getOriginal('status') === 'disputed') {
                $seller = User::find($settlement->seller_id);
                if ($seller) {
                    app(\App\Services\Wallet\SellerEarningsService::class)->sweepAwaitingKyc($seller);
                }
            }
        });
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }
}
