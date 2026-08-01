<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Gift extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'icon_url', 'animation_url', 'coin_price',
        'creator_earns', 'platform_commission', 'category',
        'is_active', 'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'coin_price' => 'integer',
        'creator_earns' => 'integer',
        'platform_commission' => 'integer',
        'sort_order' => 'integer',
    ];

    public const CATEGORIES = ['standard', 'premium', 'limited', 'exclusive'];

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }
}
