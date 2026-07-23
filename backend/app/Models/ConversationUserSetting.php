<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConversationUserSetting extends Model
{
    protected $fillable = [
        'conversation_id',
        'user_id',
        'is_muted',
        'is_archived',
    ];

    protected $casts = [
        'is_muted'    => 'boolean',
        'is_archived' => 'boolean',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
