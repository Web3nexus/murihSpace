<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FulfilmentDispute extends Model
{
    protected $fillable = [
        'fulfilment_order_id', 'raised_by', 'subject',
        'description', 'status', 'resolution', 'resolved_by', 'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public const SUBJECTS = ['not_received', 'damaged', 'wrong_item', 'defective', 'not_as_described', 'other'];

    public const STATUSES = ['open', 'under_review', 'resolved', 'dismissed'];

    public function fulfilmentOrder(): BelongsTo
    {
        return $this->belongsTo(FulfilmentOrder::class);
    }

    public function raisedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'raised_by');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
