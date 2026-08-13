<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HelpArticleRelation extends Model
{
    use HasFactory;

    protected $fillable = ['article_id', 'related_article_id', 'sort_order'];

    public function article(): BelongsTo
    {
        return $this->belongsTo(HelpArticle::class, 'article_id');
    }

    public function relatedArticle(): BelongsTo
    {
        return $this->belongsTo(HelpArticle::class, 'related_article_id');
    }
}
