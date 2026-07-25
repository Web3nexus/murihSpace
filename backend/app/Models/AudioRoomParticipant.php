<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AudioRoomParticipant extends Model
{
    protected $fillable = [
        'audio_room_id', 'user_id', 'role', 'joined_at',
        'left_at', 'is_muted', 'is_hand_raised',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
        'is_muted' => 'boolean',
        'is_hand_raised' => 'boolean',
    ];

    public function audioRoom(): BelongsTo
    {
        return $this->belongsTo(AudioRoom::class, 'audio_room_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
