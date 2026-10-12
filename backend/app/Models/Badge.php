<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Badge extends Model
{
    protected $fillable = [
        'slug', 'name', 'level_label', 'description', 'icon', 'icon_3d', 'color', 'icon_gradient', 'criteria', 'is_active', 'awarded_count',
    ];

    protected $casts = [
        'criteria' => 'array',
        'is_active' => 'boolean',
        'awarded_count' => 'integer',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(UserBadge::class);
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
