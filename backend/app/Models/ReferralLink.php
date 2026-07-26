<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReferralLink extends Model
{
    protected $fillable = [
        'creator_id', 'referral_program_id', 'code', 'clicks', 'is_active',
    ];

    protected $casts = [
        'clicks' => 'integer',
        'is_active' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(ReferralProgram::class, 'referral_program_id');
    }

    public function referrals(): HasMany
    {
        return $this->hasMany(Referral::class);
    }
}
