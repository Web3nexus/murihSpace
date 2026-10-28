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
        'e2ee',
        'status',
        'livekit_room',
        'viewers_count',
        'peak_viewers',
        'likes_count',
        'total_coins_earned',
        'background_sound',
        'pinned_product_id',
        'pinned_product_type',
        'started_at',
        'ended_at',
        'last_engagement_at',
        'idle_warned_at',
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
        'user_id' => 'integer',
        'community_id' => 'integer',
        'e2ee' => 'boolean',
        'viewers_count' => 'integer',
        'peak_viewers' => 'integer',
        'likes_count' => 'integer',
        'total_coins_earned' => 'integer',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'last_engagement_at' => 'datetime',
        'idle_warned_at' => 'datetime',
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

    /**
     * Record engagement on an active broadcast.
     *
     * Any like, chat message or new viewer resets the idle clock and clears the
     * pending inactivity warning, so the auto-close cycle only fires when a
     * broadcast is genuinely unattended.
     */
    public function touchEngagement(): void
    {
        $this->forceFill([
            'last_engagement_at' => now(),
            'idle_warned_at' => null,
        ])->saveQuietly();
    }
}
