<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FeedAlgorithmConfig extends Model
{
    use HasFactory;

    protected $fillable = [
        'feed_type', 'label', 'description', 'config', 'is_active', 'stage',
    ];

    protected $casts = [
        'config' => 'array',
        'is_active' => 'boolean',
    ];

    public const STAGES = ['development', 'staging', 'production'];
}
