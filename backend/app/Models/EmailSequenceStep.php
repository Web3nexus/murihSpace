<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailSequenceStep extends Model
{
    protected $fillable = [
        'email_sequence_id', 'subject', 'content',
        'delay_days', 'order',
    ];

    protected $casts = [
        'delay_days' => 'integer',
        'order' => 'integer',
    ];

    public function sequence(): BelongsTo
    {
        return $this->belongsTo(EmailSequence::class);
    }
}
