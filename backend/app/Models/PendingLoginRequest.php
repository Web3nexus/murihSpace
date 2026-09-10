<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PendingLoginRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'request_token',
        'device_id',
        'device_name',
        'platform',
        'ip',
        'location',
        'status',
        'expires_at',
        'approved_by_device_session_id',
        'approved_at',
        'denied_at',
        'authorized_token',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'approved_at' => 'datetime',
        'denied_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function approvedBySession(): BelongsTo
    {
        return $this->belongsTo(DeviceSession::class, 'approved_by_device_session_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending' && $this->expires_at->isFuture();
    }
}

