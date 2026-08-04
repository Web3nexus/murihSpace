<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WalletHold extends Model
{
    protected $fillable = [
        'user_id',
        'wallet_id',
        'wallet_type',
        'amount',
        'currency',
        'balance_category',
        'reason',
        'reference_type',
        'reference_id',
        'status',
        'expires_at',
        'released_at',
    ];

    protected $casts = [
        'amount'      => 'integer',
        'expires_at'  => 'datetime',
        'released_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class);
    }
}
