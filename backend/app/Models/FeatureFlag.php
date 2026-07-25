<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeatureFlag extends Model
{
    protected $fillable = [
        'key', 'label', 'description', 'enabled',
        'is_scheduled', 'scheduled_at',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'is_scheduled' => 'boolean',
        'scheduled_at' => 'datetime',
    ];
}
