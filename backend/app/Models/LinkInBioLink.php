<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LinkInBioLink extends Model
{
    protected $fillable = [
        'user_id',
        'title',
        'url',
        'category',
        'badge',
        'price',
        'currency',
        'icon_emoji',
        'icon_3d',
        'is_active',
        'click_count',
        'unique_visitors',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'click_count' => 'integer',
        'unique_visitors' => 'integer',
        'price' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
