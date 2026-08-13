<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HelpArticleFeedback extends Model
{
    use HasFactory;

    protected $fillable = [
        'article_id', 'helpful', 'comment', 'user_email', 'ip_address',
    ];

    protected $casts = [
        'helpful' => 'boolean',
    ];

    public function article(): BelongsTo
    {
        return $this->belongsTo(HelpArticle::class, 'article_id');
    }
}
