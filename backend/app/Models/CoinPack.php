<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CoinPack extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'coins', 'bonus_coins', 'price', 'currency',
        'badge', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'coins' => 'integer',
        'bonus_coins' => 'integer',
        'price' => 'integer',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function purchases(): HasMany
    {
        return $this->hasMany(CoinPurchase::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }
}
