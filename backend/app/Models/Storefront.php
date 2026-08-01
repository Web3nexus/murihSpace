<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Storefront extends Model
{
    protected $fillable = [
        'user_id',
        'is_published',
        'display_name',
        'tagline',
        'bio',
        'cover_url',
        'avatar_url',
        'short_code',
        'links',
        'name',
        'currency',
        'tax_rate',
        'shipping_policy',
        'return_policy',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'links' => 'array',
        'tax_rate' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
