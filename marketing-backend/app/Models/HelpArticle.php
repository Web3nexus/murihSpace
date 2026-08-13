<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HelpArticle extends Model
{
    use HasFactory;

    public const STATES = ['draft', 'review', 'scheduled', 'published', 'archived'];

    protected $fillable = [
        'category_id', 'slug', 'title', 'excerpt', 'body', 'sections',
        'keywords', 'tags', 'state', 'featured',
        'seo_title', 'seo_description', 'canonical_url',
        'view_count', 'helpful_count', 'not_helpful_count',
        'published_at', 'scheduled_at', 'archived_at',
    ];

    protected $casts = [
        'sections' => 'array',
        'keywords' => 'array',
        'tags' => 'array',
        'featured' => 'boolean',
        'published_at' => 'datetime',
        'scheduled_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(HelpCategory::class, 'category_id');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(HelpArticleRevision::class, 'article_id');
    }

    public function feedback(): HasMany
    {
        return $this->hasMany(HelpArticleFeedback::class, 'article_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(HelpAttachment::class, 'article_id');
    }

    public function relatedArticles(): BelongsToMany
    {
        return $this->belongsToMany(HelpArticle::class, 'help_article_relations', 'article_id', 'related_article_id')
            ->withPivot('sort_order')
            ->orderBy('help_article_relations.sort_order')
            ->withTimestamps();
    }

    public function scopePublished($query)
    {
        return $query->where('state', 'published')
            ->where(function ($q) {
                $q->whereNull('published_at')->orWhere('published_at', '<=', now());
            });
    }

    public function scopeFeatured($query)
    {
        return $query->where('featured', true);
    }
}
