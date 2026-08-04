<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LedgerAccount extends Model
{
    protected $fillable = [
        'user_id',
        'wallet_type',
        'code',
        'name',
        'account_type',
        'currency',
        'is_system',
    ];

    protected $casts = [
        'is_system' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
