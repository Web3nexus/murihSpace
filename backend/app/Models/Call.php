<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Call extends Model
{
    use HasFactory;

    protected $fillable = [
        'caller_id',
        'recipient_id',
        'conversation_id',
        'type',
        'status',
        'room_name',
        'started_at',
        'ended_at',
        'duration_seconds',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'duration_seconds' => 'integer',
    ];

    public function caller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'caller_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class, 'conversation_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(CallParticipant::class, 'call_id');
    }

    /**
     * Get array of all unique user IDs connected or invited to this call.
     */
    public function allParticipantUserIds(): array
    {
        $ids = [$this->caller_id, $this->recipient_id];
        $extraIds = $this->participants()
            ->whereIn('status', ['ringing', 'accepted'])
            ->pluck('user_id')
            ->toArray();

        return array_values(array_unique(array_filter(array_merge($ids, $extraIds))));
    }
}
