<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CoachingSlot extends Model
{
    protected $fillable = [
        'service_id', 'start_time', 'end_time', 'is_booked',
    ];

    protected $casts = [
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'is_booked' => 'boolean',
    ];

    public function service(): BelongsTo
    {
        return $this->belongsTo(CoachingService::class, 'service_id');
    }

    public function scopeAvailable($query)
    {
        return $query->where('is_booked', false)
            ->where('start_time', '>', now());
    }

    public function scopeUpcoming($query)
    {
        return $query->where('start_time', '>', now())
            ->orderBy('start_time');
    }
}
