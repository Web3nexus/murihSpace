<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Hash;

class Wallet extends Model
{
    public const TYPES = ['system', 'creator', 'business'];

    public const CATEGORIES = [
        'available',
        'pending',
        'reserved',
        'escrow',
        'withdrawable',
        'non_withdrawable',
        'disputed',
    ];

    public const STATUSES = ['active', 'locked', 'suspended'];

    protected $fillable = [
        'user_id',
        'wallet_type',
        'available',
        'pending',
        'reserved',
        'escrow',
        'withdrawable',
        'non_withdrawable',
        'disputed',
        'currency',
        'pin_hash',
        'pin_set_at',
        'status',
    ];

    protected $casts = [
        'available'        => 'integer',
        'pending'          => 'integer',
        'reserved'         => 'integer',
        'escrow'           => 'integer',
        'withdrawable'     => 'integer',
        'non_withdrawable' => 'integer',
        'disputed'         => 'integer',
        'pin_set_at'       => 'datetime',
    ];

    /**
     * Hide pin_hash from all JSON serialization to prevent hash leakage.
     */
    protected $hidden = [
        'pin_hash',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function entries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class, 'user_id', 'user_id');
    }

    public function holds(): HasMany
    {
        return $this->hasMany(WalletHold::class);
    }

    /**
     * Sum of all disjoint balance categories.
     *
     * Architecture note: The categories in CATEGORIES are DISJOINT buckets.
     * `withdrawable` and `non_withdrawable` are subsets of `available`
     * only in a logical/business sense (they track eligibility), but
     * are tracked as separate physical columns that LedgerService manages.
     * placeHold moves available → reserved/escrow/pending.
     * WithdrawalController uses `withdrawable` as the authoritative
     * column for determining how much a user may withdraw.
     */
    public function totalBalance(): int
    {
        return $this->available + $this->pending + $this->reserved + $this->escrow
            + $this->withdrawable + $this->non_withdrawable + $this->disputed;
    }

    public function hasPin(): bool
    {
        return $this->pin_hash !== null;
    }

    public function verifyPin(string $pin): bool
    {
        if (! $this->hasPin()) {
            return false;
        }

        return Hash::check($pin, $this->pin_hash);
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
