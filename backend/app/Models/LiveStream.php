<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class LiveStream extends Model
{
    use HasFactory;

    protected $fillable = [
        'tracking_id',
        'user_id',
        'community_id',
        'title',
        'description',
        'stream_mode',
        'status',
        'livekit_room',
        'viewers_count',
        'peak_viewers',
        'likes_count',
        'total_coins_earned',
        'background_sound',
        'pinned_product_id',
        'started_at',
        'ended_at',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $stream): void {
            if (! $stream->tracking_id) {
                $stream->tracking_id = (string) Str::uuid();
            }
        });
    }

    protected $casts = [
        'viewers_count' => 'integer',
        'peak_viewers' => 'integer',
        'likes_count' => 'integer',
        'total_coins_earned' => 'integer',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    public function participants(): HasMany
    {
        return $this->hasMany(LiveStreamParticipant::class);
    }

    public function activeParticipants(): HasMany
    {
        return $this->hasMany(LiveStreamParticipant::class)->where('is_active', true);
    }

    public function likes(): HasMany
    {
        return $this->hasMany(LiveStreamLike::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(LiveStreamMessage::class);
    }

    public function attributions(): HasMany
    {
        return $this->hasMany(LiveStreamAttribution::class);
    }

    public function isLive(): bool
    {
        return $this->status === 'live';
    }
}
