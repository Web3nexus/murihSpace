<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Server-authoritative roster entry for a meeting attendee.
 *
 * The LiveKit room owns the media; this table owns the *state* (who is in the
 * room, what their mic/camera state is, what a host has restricted) so every
 * client renders the same list and a reconnect restores the truth.
 */
class MeetingParticipant extends Model
{
    use HasFactory;

    public const ROLE_HOST = 'host';

    public const ROLE_CO_HOST = 'co_host';

    public const ROLE_MODERATOR = 'moderator';

    public const ROLE_PARTICIPANT = 'participant';

    protected $fillable = [
        'meeting_id',
        'user_id',
        'role',
        'is_active',
        'is_muted',
        'is_camera_on',
        'is_restricted',
        'joined_at',
        'left_at',
        'last_seen_at',
        'removed_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_muted' => 'boolean',
        'is_camera_on' => 'boolean',
        'is_restricted' => 'boolean',
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'removed_at' => 'datetime',
    ];

    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function isHost(): bool
    {
        return $this->role === self::ROLE_HOST;
    }

    /**
     * Hosts, co-hosts and moderators may drive other participants.
     */
    public function canModerate(): bool
    {
        return in_array($this->role, [self::ROLE_HOST, self::ROLE_CO_HOST, self::ROLE_MODERATOR], true);
    }

    /**
     * Wire shape consumed by the web and Flutter clients.
     *
     * @return array<string, mixed>
     */
    public function toPresencePayload(): array
    {
        $user = $this->user;

        return [
            'user_id' => (int) $this->user_id,
            'name' => $user?->name ?? 'Guest',
            'username' => $user?->username ?? null,
            'avatar_url' => $user?->avatar_url ?? $user?->avatar ?? null,
            'role' => $this->role,
            'is_active' => (bool) $this->is_active,
            'is_muted' => (bool) $this->is_muted,
            'is_camera_on' => (bool) $this->is_camera_on,
            'is_restricted' => (bool) $this->is_restricted,
            'joined_at' => $this->joined_at?->toIso8601String(),
            'left_at' => $this->left_at?->toIso8601String(),
        ];
    }
}
