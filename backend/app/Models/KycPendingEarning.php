<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A credit held in `pending` because the seller has not verified their identity yet. */
class KycPendingEarning extends Model
{
    protected $fillable = [
        'user_id', 'ledger_transaction_id', 'amount', 'currency', 'source', 'reason', 'swept_at',
    ];

    protected $casts = [
        'amount' => 'integer',
        'swept_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
