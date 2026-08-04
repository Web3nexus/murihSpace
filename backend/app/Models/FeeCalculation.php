<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeeCalculation extends Model
{
    protected $fillable = [
        'fee_rule_id',
        'ledger_transaction_id',
        'gross_amount',
        'fee_amount',
        'net_amount',
        'currency',
    ];

    protected $casts = [
        'gross_amount' => 'integer',
        'fee_amount'   => 'integer',
        'net_amount'   => 'integer',
    ];

    public function rule(): BelongsTo
    {
        return $this->belongsTo(FeeRule::class, 'fee_rule_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(LedgerTransaction::class, 'ledger_transaction_id');
    }
}
