<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Hash;

class Wallet extends Model
{
    protected $fillable = [
        'user_id', 'balance', 'currency', 'pin_hash', 'pin_set_at', 'status',
    ];

    protected $casts = [
        'balance' => 'integer',
        'pin_set_at' => 'datetime',
    ];

    public const STATUSES = ['active', 'locked', 'suspended'];

    public const ACCOUNT_TYPES = ['user_wallet', 'platform_revenue', 'escrow'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function entries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class, 'user_id', 'user_id');
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
