<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationPreference extends Model
{
    protected $fillable = ['user_id', 'type', 'channel', 'enabled'];

    protected $casts = ['enabled' => 'boolean'];

    public const TYPES = [
        'new_post',
        'new_member',
        'new_message',
        'new_reaction',
        'new_comment',
        'moderation_action',
        'join_request',
        'join_approved',
        'ticket_created',
        'ticket_reply',
        'ticket_status_changed',
        'ticket_info_requested',
        'ticket_resolved',
        'ticket_reopened',
    ];

    public const CHANNELS = ['in_app', 'email', 'push'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
