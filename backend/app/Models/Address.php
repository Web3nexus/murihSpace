<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Address extends Model
{
    protected $fillable = [
        'user_id', 'label', 'full_name', 'phone', 'street_line1', 'street_line2',
        'city', 'state', 'postal_code', 'country', 'type', 'is_default',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public const TYPES = ['shipping', 'billing', 'both'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }
}
