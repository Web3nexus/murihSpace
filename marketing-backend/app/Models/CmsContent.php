<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CmsContent extends Model
{
    use HasFactory;

    public const STATES = ['draft', 'review', 'scheduled', 'published', 'archived'];

    protected $table = 'cms_content';

    protected $fillable = [
        'section', 'slug', 'title', 'excerpt', 'body', 'content',
        'state', 'sort_order', 'seo_title', 'seo_description',
        'published_at', 'scheduled_at', 'archived_at',
    ];

    protected $casts = [
        'content' => 'array',
        'published_at' => 'datetime',
        'scheduled_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    public function revisions(): HasMany
    {
        return $this->hasMany(CmsContentRevision::class, 'content_id');
    }

    public function scopePublished($query)
    {
        return $query->where('state', 'published')
            ->where(function ($q) {
                $q->whereNull('published_at')->orWhere('published_at', '<=', now());
            });
    }
}
