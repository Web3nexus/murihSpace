<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class LedgerTransaction extends Model
{
    protected $fillable = [
        'ulid', 'type', 'description', 'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public const TYPES = [
        'payment', 'receive', 'transfer_out', 'transfer_in',
        'donation_out', 'donation_in', 'withdrawal', 'fee', 'refund',
    ];

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
        $sum = $this->entries()
            ->selectRaw("SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END) as net")
            ->value('net');

        return $sum === 0 || $sum === null;
    }
}
