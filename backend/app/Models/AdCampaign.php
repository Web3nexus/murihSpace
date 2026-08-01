<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AdCampaign extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id', 'name', 'objective', 'status', 'daily_budget', 'total_budget',
        'start_date', 'end_date', 'targeting', 'placements', 'is_self_service',
        'review_status', 'review_notes', 'reviewed_by', 'reviewed_at',
    ];

    protected $casts = [
        'targeting' => 'array',
        'placements' => 'array',
        'start_date' => 'datetime',
        'end_date' => 'datetime',
        'reviewed_at' => 'datetime',
        'is_self_service' => 'boolean',
    ];

    public const OBJECTIVES = [
        'post_engagement', 'profile_followers', 'product_sales',
        'product_traffic', 'community_promotion', 'community_membership',
        'event_promotion', 'video_views', 'messages_enquiries', 'external_traffic',
    ];

    public const STATUSES = ['draft', 'active', 'paused', 'completed', 'cancelled'];

    public const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'suspended', 'removed'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function creatives(): HasMany
    {
        return $this->hasMany(AdCreative::class, 'campaign_id');
    }

    public function analytics(): HasMany
    {
        return $this->hasMany(AdAnalytics::class, 'campaign_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopePendingReview($query)
    {
        return $query->where('review_status', 'pending');
    }
}
