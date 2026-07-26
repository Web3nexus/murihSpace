<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShippingProfile extends Model
{
    protected $fillable = [
        'creator_id', 'name', 'base_rate', 'per_item_rate',
        'estimated_days_min', 'estimated_days_max',
        'countries', 'currency', 'is_active',
    ];

    protected $casts = [
        'countries' => 'array',
        'is_active' => 'boolean',
        'base_rate' => 'integer',
        'per_item_rate' => 'integer',
        'estimated_days_min' => 'integer',
        'estimated_days_max' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function calculateCost(int $itemCount): int
    {
        return (int) $this->base_rate + ($this->per_item_rate * max(0, $itemCount - 1));
    }
}
