<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HelpCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'parent_id', 'slug', 'name', 'blurb', 'icon',
        'sort_order', 'featured', 'is_active',
    ];

    protected $casts = [
        'featured' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(HelpCategory::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(HelpCategory::class, 'parent_id');
    }

    public function articles(): HasMany
    {
        return $this->hasMany(HelpArticle::class, 'category_id');
    }
}
