<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CoinPurchase extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'coin_pack_id', 'coins', 'bonus_coins',
        'amount_paid', 'currency', 'status', 'provider', 'reference',
    ];

    protected $casts = [
        'coins' => 'integer',
        'bonus_coins' => 'integer',
        'amount_paid' => 'integer',
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
