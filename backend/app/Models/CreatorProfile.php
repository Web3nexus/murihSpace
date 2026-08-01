<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CreatorProfile extends Model
{
    protected $fillable = [
        'user_id', 'about', 'niche', 'community_interests', 'content_interests', 'onboarding_completed_at',
    ];

    protected $casts = [
        'community_interests' => 'array',
        'content_interests' => 'array',
        'onboarding_completed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
