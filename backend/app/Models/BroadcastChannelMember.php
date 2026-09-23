<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BroadcastChannelMember extends Model
{
    use HasFactory;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_REMOVED = 'removed';

    protected $fillable = [
        'broadcast_channel_id',
        'user_id',
        'status',
        'joined_at',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
    ];

    public function channel(): BelongsTo
    {
        return $this->belongsTo(BroadcastChannel::class, 'broadcast_channel_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}