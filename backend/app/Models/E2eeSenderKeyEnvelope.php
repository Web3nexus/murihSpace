<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A sender key distribution for one group epoch, encrypted to one recipient over
 * their 1:1 session. The server stores the ciphertext only and removes it once the
 * recipient acknowledges it.
 */
class E2eeSenderKeyEnvelope extends Model
{
    protected $fillable = [
        'conversation_id',
        'sender_user_id',
        'recipient_user_id',
        'epoch',
        'ciphertext',
    ];

    protected $casts = [
        'epoch' => 'integer',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }
}
