<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DepositTransaction extends Model
{
    protected $fillable = [
        'user_id',
        'wallet_type',
        'idempotency_key',
        'payment_gateway',
        'gateway_reference',
        'amount',
        'fee_amount',
        'net_amount',
        'currency',
        'status',
        'ledger_transaction_id',
        'wallet_credited_at',
        'gateway_payload',
    ];

    protected $casts = [
        'amount'             => 'integer',
        'fee_amount'         => 'integer',
        'net_amount'         => 'integer',
        'wallet_credited_at' => 'datetime',
        'gateway_payload'    => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function ledgerTransaction(): BelongsTo
    {
        return $this->belongsTo(LedgerTransaction::class);
    }
}
