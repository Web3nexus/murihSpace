<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HelpArticleRevision extends Model
{
    use HasFactory;

    protected $fillable = [
        'article_id', 'revision_number', 'title', 'excerpt', 'body',
        'sections', 'keywords', 'tags',
        'seo_title', 'seo_description', 'canonical_url',
        'created_by_type', 'created_by_id', 'note',
    ];

    protected $casts = [
        'sections' => 'array',
        'keywords' => 'array',
        'tags' => 'array',
    ];

    public function article(): BelongsTo
    {
        return $this->belongsTo(HelpArticle::class, 'article_id');
    }
}
