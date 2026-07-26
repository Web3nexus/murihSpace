<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrackingEvent extends Model
{
    protected $fillable = [
        'fulfilment_order_id', 'event', 'location', 'description', 'occurred_at',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
    ];

    public const EVENTS = [
        'order_placed', 'confirmed', 'processing', 'picked_up',
        'in_transit', 'out_for_delivery', 'delivered', 'cancelled',
    ];

    public function fulfilmentOrder(): BelongsTo
    {
        return $this->belongsTo(FulfilmentOrder::class);
    }
}
