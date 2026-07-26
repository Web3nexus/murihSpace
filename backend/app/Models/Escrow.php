<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Escrow extends Model
{
    protected $fillable = [
        'order_id', 'buyer_id', 'seller_id', 'ledger_transaction_id',
        'amount', 'currency', 'status', 'release_window_days', 'released_at',
    ];

    protected $casts = [
        'amount' => 'integer',
        'release_window_days' => 'integer',
        'released_at' => 'datetime',
    ];

    public const STATUSES = ['held', 'released', 'refunded', 'disputed'];

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
