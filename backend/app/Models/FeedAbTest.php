<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedAbTest extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'feed_type', 'control_config', 'variant_config',
        'traffic_percentage', 'status', 'started_at', 'ended_at', 'created_by',
    ];

    protected $casts = [
        'control_config' => 'array',
        'variant_config' => 'array',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public const STATUSES = ['draft', 'running', 'paused', 'completed', 'cancelled'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
