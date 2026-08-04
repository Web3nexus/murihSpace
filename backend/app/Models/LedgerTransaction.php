<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class LedgerTransaction extends Model
{
    protected $fillable = [
        'ulid',
        'idempotency_key',
        'type',
        'status',
        'description',
        'metadata',
        'initiated_by',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public const TYPES = [
        'payment', 'receive', 'transfer_out', 'transfer_in',
        'donation_out', 'donation_in', 'withdrawal', 'fee', 'refund',
        'escrow_hold', 'escrow_release', 'escrow_refund', 'internal_transfer',
        'deposit', 'creator_gift_receipt', 'business_sale',
    ];

    public const STATUSES = ['pending', 'completed', 'reversed'];

    protected static function booted(): void
    {
        static::creating(function (self $txn) {
            if (empty($txn->ulid)) {
                $txn->ulid = (string) Str::ulid();
            }
        });
    }

    public function entries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class);
    }

    public function isBalanced(): bool
    {
        $this->loadMissing('entries');

        $debits  = (int) $this->entries->where('entry_type', 'debit')->sum('amount');
        $credits = (int) $this->entries->where('entry_type', 'credit')->sum('amount');

        return $debits === $credits;
    }
}
