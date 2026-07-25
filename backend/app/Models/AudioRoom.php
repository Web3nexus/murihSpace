<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AudioRoom extends Model
{
    protected $fillable = [
        'community_id', 'creator_id', 'title', 'description', 'cover_url',
        'status', 'scheduled_at', 'started_at', 'ended_at',
        'max_participants', 'is_recorded', 'recording_url',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'is_recorded' => 'boolean',
        'max_participants' => 'integer',
    ];

    public const STATUSES = ['scheduled', 'live', 'ended', 'cancelled'];

    public const ROLES = ['host', 'co_host', 'speaker', 'listener'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    public function participants(): HasMany
    {
        return $this->hasMany(AudioRoomParticipant::class, 'audio_room_id');
    }

    public function activeParticipants()
    {
        return $this->participants()->whereNull('left_at');
    }

    public function speakers()
    {
        return $this->participants()->whereNull('left_at')->whereIn('role', ['host', 'co_host', 'speaker']);
    }

    public function scopeUpcoming($query)
    {
        return $query->where('status', 'scheduled')
            ->where('scheduled_at', '>', now())
            ->orWhere('status', 'live');
    }

    public function scopeForCommunity($query, int $communityId)
    {
        return $query->where('community_id', $communityId);
    }
}
