<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiveStreamAttribution extends Model
{
    use HasFactory;

    protected $fillable = [
        'live_stream_id',
        'session_id',
        'user_id',
        'device_session_id',
        'source',
        'first_seen_at',
        'last_seen_at',
        'click_count',
        'join_count',
        'leave_count',
        'joined_at',
        'left_at',
        'referrer',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'first_seen_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
        'click_count' => 'integer',
        'join_count' => 'integer',
        'leave_count' => 'integer',
    ];

    public function liveStream(): BelongsTo
    {
        return $this->belongsTo(LiveStream::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function deviceSession(): BelongsTo
    {
        return $this->belongsTo(DeviceSession::class);
    }
}
