<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One retained revision of a message.
 *
 * The chain of these rows is what an edit leaves behind: `previous_content`
 * always holds the text that was live immediately before this revision, so the
 * original message is always recoverable even if it has been edited many times.
 */
class MessageEdit extends Model
{
    protected $fillable = [
        'message_id',
        'editor_id',
        'previous_content',
        'content',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_id');
    }
}