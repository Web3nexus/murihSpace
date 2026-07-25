<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Event extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_id',
        'creator_id',
        'title',
        'slug',
        'description',
        'event_type',
        'start_date',
        'end_date',
        'timezone',
        'location',
        'meeting_url',
        'cover_url',
        'capacity',
        'registration_deadline',
        'status',
        'is_featured',
    ];

    protected $casts = [
        'start_date' => 'datetime',
        'end_date' => 'datetime',
        'registration_deadline' => 'datetime',
        'is_featured' => 'boolean',
        'capacity' => 'integer',
    ];

    public const EVENT_TYPES = ['online', 'in_person', 'hybrid'];

    public const STATUSES = ['draft', 'published', 'cancelled', 'completed'];

    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(EventRegistration::class);
    }

    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }

    public function scopeUpcoming($query)
    {
        return $query->where('start_date', '>=', now());
    }

    public function scopePast($query)
    {
        return $query->where('end_date', '<', now());
    }

    public function scopeByCommunity($query, int $communityId)
    {
        return $query->where('community_id', $communityId);
    }

    public function isFull(): bool
    {
        if ($this->capacity === null) {
            return false;
        }

        return $this->registrations()->where('status', 'registered')->count() >= $this->capacity;
    }

    public function isRegistrationOpen(): bool
    {
        if ($this->status !== 'published') {
            return false;
        }
        if ($this->registration_deadline && $this->registration_deadline->isPast()) {
            return false;
        }

        return ! $this->isFull();
    }

    public function registrationCount(): int
    {
        return $this->registrations()->where('status', 'registered')->count();
    }
}
