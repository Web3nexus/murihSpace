<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmailSequence extends Model
{
    protected $fillable = [
        'creator_id', 'title', 'description',
        'trigger_event', 'status', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public const TRIGGER_EVENTS = ['purchase', 'signup', 'subscription', 'follow', 'custom'];

    public const STATUSES = ['draft', 'active', 'paused', 'completed'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function steps(): HasMany
    {
        return $this->hasMany(EmailSequenceStep::class)->orderBy('order');
    }
}
