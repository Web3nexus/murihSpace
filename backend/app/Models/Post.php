<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Post extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'community_id',
        'user_id',
        'type',
        'content',
        'media_urls',
        'link_url',
        'is_draft',
        'likes_count',
        'comments_count',
    ];

    protected $casts = [
        'media_urls' => 'array',
        'is_draft' => 'boolean',
        'likes_count' => 'integer',
        'comments_count' => 'integer',
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
}
