<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FeedWeight extends Model
{
    use HasFactory;

    protected $fillable = [
        'feed_type', 'signal_name', 'weight', 'is_active', 'label', 'description', 'group',
    ];

    protected $casts = [
        'weight' => 'decimal:4',
        'is_active' => 'boolean',
    ];

    public const SIGNALS = [
        'post_recency', 'friend_relationship', 'follower_relationship',
        'community_relationship', 'likes', 'dislikes', 'comments', 'replies',
        'shares', 'saves', 'video_watch_time', 'video_completion',
        'product_engagement', 'purchases', 'reports', 'hides', 'spam_score',
        'content_originality', 'creator_trust_score', 'community_trust_score',
        'location_relevance', 'language_relevance', 'trending_score',
        'new_creator_boost', 'sponsored_frequency', 'content_diversity',
    ];

    public const FEED_TYPES = ['home', 'following', 'friends', 'community', 'creator', 'marketplace', 'video', 'trending', 'local', 'recommended'];

    public function scopeActive($query, string $feedType = 'home')
    {
        return $query->where('feed_type', $feedType)->where('is_active', true);
    }
}
