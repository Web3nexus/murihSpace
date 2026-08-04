<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PhoneOtpRequest extends Model
{
    protected $fillable = [
        'user_id', 'phone_e164', 'country_iso2', 'intent', 'driver', 'twilio_sid',
        'code_hash', 'code_expires_at', 'status', 'attempts', 'ip_address',
        'user_agent', 'device_id', 'metadata',
    ];

    protected $casts = [
        'code_expires_at' => 'datetime',
        'metadata' => 'array',
    ];

    public const INTENTS = ['register', 'login', 'verify_new', 'change'];

    public const STATUSES = ['requested', 'verified', 'failed', 'expired', 'blocked', 'rate_limited'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function maskedPhone(): string
    {
        $digits = preg_replace('/\D+/', '', (string) $this->phone_e164);

        if (strlen($digits) <= 4) {
            return '+'.str_repeat('•', max(0, strlen($digits) - 1)).substr($digits, -1);
        }

        $head = substr($digits, 0, max(1, strlen($digits) - 6));
        $tail = substr($digits, -3);

        return '+'.$head.' ••• '.$tail;
    }
}
