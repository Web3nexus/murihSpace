<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PageSection extends Model
{
    protected $fillable = [
        'page', 'key', 'type', 'label', 'content', 'meta', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'content' => 'array',
        'meta' => 'array',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function scopePage($query, string $page)
    {
        return $query->where('page', $page);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeSorted($query)
    {
        return $query->orderBy('sort_order');
    }

    public function scopeByKey($query, string $key)
    {
        return $query->where('key', $key);
    }
}
