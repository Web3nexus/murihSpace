<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReferralProgram extends Model
{
    protected $fillable = [
        'creator_id', 'is_active', 'reward_type', 'reward_value', 'description',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'reward_value' => 'integer',
    ];

    public const REWARD_TYPES = ['credit', 'percentage', 'fixed'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function links(): HasMany
    {
        return $this->hasMany(ReferralLink::class);
    }
}
