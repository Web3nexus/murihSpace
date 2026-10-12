<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HashtagStat extends Model
{
    use HasFactory;

    protected $fillable = [
        'hashtag_id', 'date', 'posts_count',
    ];

    protected $casts = [
        'posts_count' => 'integer',
    ];

    public function hashtag(): BelongsTo
    {
        return $this->belongsTo(Hashtag::class);
    }
}
