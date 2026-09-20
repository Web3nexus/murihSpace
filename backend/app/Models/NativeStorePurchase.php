<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NativeStorePurchase extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'coin_pack_id', 'store', 'store_transaction_id', 'store_order_id',
        'product_id', 'amount_minor', 'currency', 'credited_coins', 'status',
        'internal_reference', 'ledger_transaction_id', 'payload',
    ];

    protected $casts = [
        'amount_minor' => 'integer',
        'credited_coins' => 'integer',
        'payload' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function coinPack(): BelongsTo
    {
        return $this->belongsTo(CoinPack::class);
    }
}