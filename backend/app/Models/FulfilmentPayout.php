<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FulfilmentPayout extends Model
{
    protected $fillable = [
        'creator_id', 'fulfilment_order_id',
        'gross_amount', 'platform_fee', 'net_amount',
        'currency', 'status', 'paid_at',
    ];

    protected $casts = [
        'gross_amount' => 'integer',
        'platform_fee' => 'integer',
        'net_amount' => 'integer',
        'paid_at' => 'datetime',
    ];

    public const STATUSES = ['pending', 'paid', 'failed'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function fulfilmentOrder(): BelongsTo
    {
        return $this->belongsTo(FulfilmentOrder::class);
    }
}
