<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CoachingService extends Model
{
    protected $fillable = [
        'creator_id', 'name', 'description', 'duration_minutes', 'price',
        'currency', 'location_type', 'meeting_url', 'is_active',
        'buffer_minutes', 'max_daily_bookings',
    ];

    protected $casts = [
        'duration_minutes' => 'integer',
        'price' => 'integer',
        'is_active' => 'boolean',
        'buffer_minutes' => 'integer',
        'max_daily_bookings' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function slots(): HasMany
    {
        return $this->hasMany(CoachingSlot::class, 'service_id');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(CoachingBooking::class, 'service_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForCreator($query, int $creatorId)
    {
        return $query->where('creator_id', $creatorId);
    }

    public function upcomingSlots()
    {
        return $this->slots()
            ->where('start_time', '>', now())
            ->where('is_booked', false)
            ->orderBy('start_time');
    }
}
