<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LedgerEntry extends Model
{
    protected $fillable = [
        'ledger_transaction_id',
        'account_type',
        'wallet_type',
        'balance_category',
        'user_id',
        'entry_type',
        'amount',
        'currency',
        'balance_before',
        'balance_after',
    ];

    protected $casts = [
        'amount'         => 'integer',
        'balance_before' => 'integer',
        'balance_after'  => 'integer',
    ];

    public const ENTRY_TYPES = ['debit', 'credit'];

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(LedgerTransaction::class, 'ledger_transaction_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
