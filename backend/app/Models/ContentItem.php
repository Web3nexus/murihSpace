<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContentItem extends Model
{
    protected $fillable = ['creator_id', 'title', 'type', 'status', 'content', 'thumbnail_url', 'views'];

    protected $casts = ['views' => 'integer'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }
}
