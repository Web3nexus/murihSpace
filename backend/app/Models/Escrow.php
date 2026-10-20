<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Escrow extends Model
{
    protected $fillable = [
        'order_id', 'fulfilment_order_id', 'buyer_id', 'seller_id', 'ledger_transaction_id',
        'amount', 'currency', 'status', 'release_window_days', 'captured_at', 'released_at', 'refunded_at',
        'delivery_kind', 'delivered_at', 'buyer_confirmed_at', 'release_at', 'held_at', 'hold_reason',
        'reminder_sent_at', 'delivery_alert_at',
    ];

    protected $casts = [
        'amount' => 'integer',
        'release_window_days' => 'integer',
        'captured_at' => 'datetime',
        'released_at' => 'datetime',
        'refunded_at' => 'datetime',
        'delivered_at' => 'datetime',
        'buyer_confirmed_at' => 'datetime',
        'release_at' => 'datetime',
        'held_at' => 'datetime',
        'reminder_sent_at' => 'datetime',
        'delivery_alert_at' => 'datetime',
    ];

    /** `on_hold` freezes the funds: no release and no refund until staff or the parties act. */
    public const STATUSES = ['held', 'on_hold', 'released', 'refunded', 'disputed'];

    protected static function booted(): void
    {
        // Leaving a hold or a dispute can release earnings that were held for review.
        static::updated(function (Escrow $escrow) {
            if ($escrow->wasChanged('status') && in_array($escrow->getOriginal('status'), ['on_hold', 'disputed'], true)) {
                $seller = \App\Models\User::find($escrow->seller_id);
                if ($seller) {
                    app(\App\Services\Wallet\SellerEarningsService::class)->sweepAwaitingKyc($seller);
                }
            }
        });

        // Every new escrow gets its first check date at creation. Until a delivery is
        // recorded, this is the day the escrow is put on hold instead of released.
        static::creating(function (Escrow $escrow) {
            if ($escrow->release_at === null && ($escrow->status ?? 'held') === 'held') {
                $escrow->release_at = now()->addDays(\App\Services\Escrow\EscrowTimingService::NO_DELIVERY_CHECK_DAYS);
            }
        });
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function ledgerTransaction(): BelongsTo
    {
        return $this->belongsTo(LedgerTransaction::class);
    }

    public function disputes(): HasMany
    {
        return $this->hasMany(Dispute::class);
    }

    public function isReleaseable(): bool
    {
        return $this->status === 'held';
    }

    public function autoReleaseDate(): ?\Carbon\Carbon
    {
        return $this->created_at?->addDays($this->release_window_days);
    }
}
