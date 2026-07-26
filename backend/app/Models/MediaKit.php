<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MediaKit extends Model
{
    protected $fillable = [
        'creator_id', 'bio', 'profile_image_url',
        'audience_demographics', 'engagement_rate', 'total_followers',
        'avg_views', 'top_content', 'past_partnerships',
        'rate_card', 'is_published',
    ];

    protected $casts = [
        'audience_demographics' => 'array',
        'top_content' => 'array',
        'past_partnerships' => 'array',
        'rate_card' => 'array',
        'is_published' => 'boolean',
        'engagement_rate' => 'decimal:2',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }
}
