<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WithdrawalRequest extends Model
{
    protected $fillable = [
        'user_id', 'amount', 'currency', 'status',
        'rejection_reason', 'processed_by', 'processed_at', 'ledger_transaction_id',
    ];

    protected $casts = [
        'amount'       => 'integer',
        'processed_at' => 'datetime',
    ];

    public const STATUSES = ['pending', 'approved', 'processing', 'completed', 'rejected'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    public function ledgerTransaction(): BelongsTo
    {
        return $this->belongsTo(LedgerTransaction::class);
    }
}
