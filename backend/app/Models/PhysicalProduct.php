<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PhysicalProduct extends Model
{
    protected $fillable = [
        'creator_id', 'title', 'description', 'sku', 'price', 'currency',
        'category', 'images', 'stock_quantity', 'low_stock_threshold',
        'track_inventory', 'is_active', 'weight_unit', 'weight',
        'length', 'width', 'height', 'origin_country',
    ];

    protected $casts = [
        'images' => 'array',
        'price' => 'integer',
        'stock_quantity' => 'integer',
        'low_stock_threshold' => 'integer',
        'track_inventory' => 'boolean',
        'is_active' => 'boolean',
        'weight' => 'decimal:2',
        'length' => 'decimal:2',
        'width' => 'decimal:2',
        'height' => 'decimal:2',
    ];

    public const CATEGORIES = [
        'clothing', 'accessories', 'electronics', 'home',
        'beauty', 'sports', 'food', 'art', 'other',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function inStock(): bool
    {
        return ! $this->track_inventory || $this->stock_quantity > 0;
    }

    public function isLowStock(): bool
    {
        return $this->track_inventory && $this->stock_quantity <= $this->low_stock_threshold;
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->where(function ($q) {
            $q->where('track_inventory', false)->orWhere('stock_quantity', '>', 0);
        });
    }

    public function scopeLowStock($query)
    {
        return $query->where('track_inventory', true)
            ->whereColumn('stock_quantity', '<=', 'low_stock_threshold');
    }
}
