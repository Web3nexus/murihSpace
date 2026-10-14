<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QrLoginTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'qr_token',
        'poll_token_hash',
        'status',
        'user_id',
        'device_id',
        'device_name',
        'platform',
        'ip',
        'user_agent',
        'location',
        'approved_by_device_session_id',
        'scanned_at',
        'approved_at',
        'denied_at',
        'expires_at',
        'authorized_token',
        'confirmation_code_hash',
        'confirmation_attempts',
    ];

    protected $hidden = [
        'authorized_token',
        'poll_token_hash',
        'confirmation_code_hash',
    ];

    protected $casts = [
        'scanned_at' => 'datetime',
        'approved_at' => 'datetime',
        'denied_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function approvedBySession(): BelongsTo
    {
        return $this->belongsTo(DeviceSession::class, 'approved_by_device_session_id');
    }

    /**
     * True while the transaction can still be scanned/approved.
     */
    public function isOpen(): bool
    {
        return in_array($this->status, ['pending', 'scanned'], true)
            && $this->expires_at->isFuture();
    }
}
