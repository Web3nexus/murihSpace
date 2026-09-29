<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_user_id');
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