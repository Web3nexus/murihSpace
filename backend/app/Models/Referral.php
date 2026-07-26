<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Referral extends Model
{
    protected $fillable = [
        'referral_link_id', 'referred_user_id', 'type',
        'ip_address', 'user_agent', 'reward_amount', 'reward_paid', 'converted_at',
    ];

    protected $casts = [
        'reward_amount' => 'integer',
        'reward_paid' => 'boolean',
        'converted_at' => 'datetime',
    ];

    public const TYPES = ['click', 'signup', 'purchase'];

    public function link(): BelongsTo
    {
        return $this->belongsTo(ReferralLink::class, 'referral_link_id');
    }

    public function referredUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referred_user_id');
    }
}
