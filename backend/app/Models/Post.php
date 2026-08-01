<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Scout\Searchable;

class Post extends Model
{
    use HasFactory, Searchable, SoftDeletes;

    protected $fillable = [
        'community_id', 'user_id', 'type', 'content', 'media_urls',
        'link_url', 'hashtags', 'mentions', 'location',
        'is_draft', 'is_pinned', 'pinned_at', 'scheduled_at',
        'privacy', 'comments_disabled', 'accessibility_text',
        'poll_question', 'poll_options', 'poll_ends_at',
        'cta_text', 'cta_url',
    ];

    protected $casts = [
        'media_urls' => 'array',
        'hashtags' => 'array',
        'mentions' => 'array',
        'poll_options' => 'array',
        'is_draft' => 'boolean',
        'is_pinned' => 'boolean',
        'comments_disabled' => 'boolean',
        'pinned_at' => 'datetime',
        'scheduled_at' => 'datetime',
        'poll_ends_at' => 'datetime',
        'likes_count' => 'integer',
        'dislikes_count' => 'integer',
        'comments_count' => 'integer',
        'shares_count' => 'integer',
        'saves_count' => 'integer',
        'views_count' => 'integer',
    ];

    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(PostComment::class);
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(PostReaction::class);
    }

    public function scopePublished($query)
    {
        return $query->where('is_draft', false);
    }

    public function scopePinnedFirst($query)
    {
        return $query->orderBy('is_pinned', 'desc')->orderBy('created_at', 'desc');
    }

    public function scopeScheduled($query)
    {
        return $query->where('is_draft', true)->whereNotNull('scheduled_at');
    }

    public function toSearchableArray(): array
    {
        return [
            'id' => $this->id,
            'content' => $this->content,
            'hashtags' => $this->hashtags,
        ];
    }

    public function shouldBeSearchable(): bool
    {
        return ! $this->is_draft && $this->privacy === 'public';
    }
}
