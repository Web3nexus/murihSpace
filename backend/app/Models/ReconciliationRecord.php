<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReconciliationRecord extends Model
{
    protected $fillable = [
        'reconciliation_date',
        'provider',
        'payment_id',
        'provider_transaction_id',
        'internal_amount',
        'provider_amount',
        'internal_currency',
        'provider_currency',
        'internal_status',
        'provider_status',
        'discrepancy_type',
        'resolution_status',
        'notes',
    ];

    protected $casts = [
        'reconciliation_date' => 'date',
        'internal_amount' => 'integer',
        'provider_amount' => 'integer',
    ];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}

