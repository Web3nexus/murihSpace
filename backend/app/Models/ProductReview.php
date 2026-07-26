<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductReview extends Model
{
    protected $fillable = [
        'physical_product_id', 'buyer_id', 'fulfilment_order_id',
        'rating', 'title', 'body', 'is_approved',
    ];

    protected $casts = [
        'rating' => 'integer',
        'is_approved' => 'boolean',
    ];

    public function physicalProduct(): BelongsTo
    {
        return $this->belongsTo(PhysicalProduct::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function fulfilmentOrder(): BelongsTo
    {
        return $this->belongsTo(FulfilmentOrder::class);
    }

    public function scopeApproved($query)
    {
        return $query->where('is_approved', true);
    }
}
