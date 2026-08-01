<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CreatorWallet extends Model
{
    protected $table = 'creator_wallet';

    use HasFactory;

    protected $fillable = [
        'user_id', 'total_gifts_received', 'gross_earnings', 'platform_fees',
        'net_earnings', 'pending_balance', 'available_balance',
        'withdrawn_balance', 'status', 'gifting_enabled',
    ];

    protected $casts = [
        'total_gifts_received' => 'integer',
        'gross_earnings' => 'decimal:2',
        'platform_fees' => 'decimal:2',
        'net_earnings' => 'decimal:2',
        'pending_balance' => 'decimal:2',
        'available_balance' => 'decimal:2',
        'withdrawn_balance' => 'decimal:2',
        'gifting_enabled' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
