<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cart extends Model
{
    protected $fillable = ['user_id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(CartItem::class);
    }

    public function total(): int
    {
        return $this->items->sum(fn ($item) => $item->physicalProduct->price * $item->quantity);
    }

    public function itemCount(): int
    {
        return $this->items->sum('quantity');
    }
}
