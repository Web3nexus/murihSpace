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
        'greeting_message_enabled',
        'greeting_message',
        'away_message_enabled',
        'away_message',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'links' => 'array',
        'tax_rate' => 'decimal:2',
        'greeting_message_enabled' => 'boolean',
        'away_message_enabled' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
