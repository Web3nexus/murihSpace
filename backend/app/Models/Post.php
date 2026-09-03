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

    protected $appends = ['poll_results'];

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

    public function saves(): HasMany
    {
        return $this->hasMany(SavedPost::class);
    }

    public function pollVotes(): HasMany
    {
        return $this->hasMany(PostPollVote::class);
    }

    public function getPollResultsAttribute(): ?array
    {
        return $this->pollResults();
    }

    public function pollResults(): ?array
    {
        if ($this->type !== 'poll' || empty($this->poll_options)) {
            return null;
        }

        $votes = $this->pollVotes()
            ->selectRaw('option_index, count(*) as count')
            ->groupBy('option_index')
            ->pluck('count', 'option_index')
            ->toArray();

        $total = array_sum($votes);

        $options = [];
        foreach ($this->poll_options as $index => $label) {
            $count = $votes[$index] ?? 0;
            $percent = $total > 0 ? round(($count / $total) * 100, 1) : 0;
            $options[] = [
                'index' => (int) $index,
                'label' => (string) $label,
                'votes_count' => (int) $count,
                'percentage' => (float) $percent,
            ];
        }

        return [
            'total_votes' => (int) $total,
            'options' => $options,
            'is_expired' => $this->poll_ends_at ? $this->poll_ends_at->isPast() : false,
        ];
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
