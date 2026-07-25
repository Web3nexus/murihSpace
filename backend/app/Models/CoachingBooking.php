<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CoachingBooking extends Model
{
    protected $fillable = [
        'service_id', 'slot_id', 'booker_id', 'start_time', 'end_time',
        'status', 'notes', 'meeting_url', 'price_paid', 'currency',
    ];

    protected $casts = [
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'price_paid' => 'integer',
    ];

    public const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

    public function service(): BelongsTo
    {
        return $this->belongsTo(CoachingService::class, 'service_id');
    }

    public function slot(): BelongsTo
    {
        return $this->belongsTo(CoachingSlot::class, 'slot_id');
    }

    public function booker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'booker_id');
    }

    public function scopeForBooker($query, int $userId)
    {
        return $query->where('booker_id', $userId);
    }

    public function scopeForCreator($query, int $creatorId)
    {
        return $query->whereHas('service', fn ($q) => $q->where('creator_id', $creatorId));
    }

    public function scopeUpcoming($query)
    {
        return $query->where('start_time', '>', now())
            ->whereIn('status', ['confirmed']);
    }
}
