<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Milestone extends Model
{
    protected $fillable = [
        'creator_id', 'title', 'description', 'metric_type',
        'target_value', 'reward_type', 'reward_data',
        'is_active', 'starts_at', 'ends_at',
    ];

    protected $casts = [
        'reward_data' => 'array',
        'is_active' => 'boolean',
        'target_value' => 'integer',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public const METRIC_TYPES = ['followers', 'sales', 'revenue', 'products', 'engagement'];

    public const REWARD_TYPES = ['badge', 'feature', 'custom'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function userProgress(): HasMany
    {
        return $this->hasMany(UserMilestone::class);
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
