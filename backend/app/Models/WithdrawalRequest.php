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
        'amount' => 'integer',
        'processed_at' => 'datetime',
    ];

    /**
     * pending -> processing (provider transfer sent) -> completed | failed.
     * dispatch_failed: the provider did not accept the transfer; funds stay reserved until a retry or a
     * provider failure. Only the provider's confirmation can complete or fail a payout.
     */
    public const STATUSES = ['pending', 'approved', 'processing', 'dispatch_failed', 'completed', 'failed', 'rejected'];

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
