<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Hashtag extends Model
{
    use HasFactory;

    protected $fillable = [
        'tag', 'display_tag', 'posts_count', 'first_used_at', 'last_used_at',
    ];

    protected $casts = [
        'posts_count' => 'integer',
        'first_used_at' => 'datetime',
        'last_used_at' => 'datetime',
    ];

    protected $appends = ['label'];

    public function stats(): HasMany
    {
        return $this->hasMany(HashtagStat::class);
    }

    /** Rendered form, e.g. "#CreatorEconomy". */
    public function getLabelAttribute(): string
    {
        return '#' . $this->display_tag;
    }
}
