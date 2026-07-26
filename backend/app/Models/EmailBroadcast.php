<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailBroadcast extends Model
{
    protected $fillable = [
        'creator_id', 'title', 'subject', 'content',
        'status', 'recipient_count', 'sent_count',
        'open_count', 'click_count', 'sent_at',
    ];

    protected $casts = [
        'recipient_count' => 'integer',
        'sent_count' => 'integer',
        'open_count' => 'integer',
        'click_count' => 'integer',
        'sent_at' => 'datetime',
    ];

    public const STATUSES = ['draft', 'sending', 'sent', 'cancelled'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }
}
