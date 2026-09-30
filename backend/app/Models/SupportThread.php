<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SupportThread extends Model
{
    protected $fillable = ['user_id', 'subject', 'status'];

    protected $casts = ['unread' => 'integer'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportMessage::class, 'thread_id');
    }

    /**
     * Most recent message, for the administration queue.
     *
     * Lets the queue list show what a member last said without loading every
     * message of every thread — which is what eager-loading `messages` on a
     * paginated queue would do.
     */
    public function lastMessage(): HasOne
    {
        // Explicit key: the column is `thread_id`, not the `support_thread_id`
        // the hasOne convention would guess.
        return $this->hasOne(SupportMessage::class, 'thread_id')->latestOfMany();
    }
}
