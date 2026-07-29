<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoreReturn extends Model
{
    protected $fillable = ['user_id', 'fulfilment_order_id', 'product_name', 'reason', 'status', 'admin_note'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function fulfilmentOrder(): BelongsTo
    {
        return $this->belongsTo(FulfilmentOrder::class);
    }
}
