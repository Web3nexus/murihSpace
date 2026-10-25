<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Meeting extends Model
{
    protected $fillable = [
        'code',
        'host_user_id',
        'room',
        'title',
        'expires_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    /** Google Meet style room code, e.g. abc-defg-hij. */
    public static function generateCode(): string
    {
        return \Illuminate\Support\Str::lower(\Illuminate\Support\Str::random(3))
            .'-'.\Illuminate\Support\Str::lower(\Illuminate\Support\Str::random(4))
            .'-'.\Illuminate\Support\Str::lower(\Illuminate\Support\Str::random(3));
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_user_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(MeetingParticipant::class);
    }

    public function activeParticipants(): HasMany
    {
        return $this->hasMany(MeetingParticipant::class)->where('is_active', true);
    }

    /**
     * Meetings that have not yet expired (expired rows and missing expiry are
     * both treated as inactive by default).
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query
            ->whereNotNull('expires_at')
            ->where('expires_at', '>', now());
    }
}