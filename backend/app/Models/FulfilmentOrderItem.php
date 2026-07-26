<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FulfilmentOrderItem extends Model
{
    protected $fillable = [
        'fulfilment_order_id', 'physical_product_id',
        'quantity', 'unit_price', 'currency',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'integer',
    ];

    public function fulfilmentOrder(): BelongsTo
    {
        return $this->belongsTo(FulfilmentOrder::class);
    }

    public function physicalProduct(): BelongsTo
    {
        return $this->belongsTo(PhysicalProduct::class);
    }
}
