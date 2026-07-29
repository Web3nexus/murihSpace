<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinkInBioTheme extends Model
{
    protected $fillable = ['name', 'slug', 'description', 'is_premium', 'config', 'sort_order'];

    protected $casts = [
        'is_premium' => 'boolean',
        'config' => 'array',
        'sort_order' => 'integer',
    ];

    public function scopePublic($q)
    {
        return $q->where('is_premium', false);
    }
}
