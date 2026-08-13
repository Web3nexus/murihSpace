<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HelpSearchTerm extends Model
{
    use HasFactory;

    protected $fillable = [
        'query', 'result_count', 'selected_article_id', 'user_feedback', 'user_email',
    ];

    protected $casts = [
        'user_feedback' => 'boolean',
    ];

    public function selectedArticle(): BelongsTo
    {
        return $this->belongsTo(HelpArticle::class, 'selected_article_id');
    }
}
