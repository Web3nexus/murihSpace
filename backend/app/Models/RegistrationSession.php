<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RegistrationSession extends Model
{
    protected $fillable = [
        'token', 'phone_e164', 'country_iso2', 'verification_status',
        'expires_at', 'attempt_count', 'device_id', 'client_fingerprint',
        'completed_user_id',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    public const STATUSES = ['pending', 'verified', 'expired', 'consumed'];

    public function completedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_user_id');
    }

    public function isValid(): bool
    {
        return $this->verification_status === 'verified'
            && ! $this->expires_at->isPast()
            && $this->completed_user_id === null;
    }
}
