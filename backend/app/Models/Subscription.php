<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    protected $fillable = [
        'plan_id', 'subscriber_id', 'creator_id', 'status',
        'current_period_start', 'current_period_end', 'canceled_at',
        'trial_ends_at', 'payment_method',
    ];

    protected $casts = [
        'current_period_start' => 'datetime',
        'current_period_end' => 'datetime',
        'canceled_at' => 'datetime',
        'trial_ends_at' => 'datetime',
    ];

    public const STATUSES = ['active', 'canceled', 'expired', 'past_due'];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class);
    }

    public function subscriber(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subscriber_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active'
            && $this->current_period_end
            && $this->current_period_end->isFuture();
    }

    public function isOnTrial(): bool
    {
        return $this->trial_ends_at && $this->trial_ends_at->isFuture();
    }

    public function daysRemaining(): int
    {
        if (! $this->current_period_end) return 0;
        return max(0, now()->diffInDays($this->current_period_end, false));
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active')
            ->where('current_period_end', '>', now());
    }

    public function scopeForSubscriber($query, int $userId)
    {
        return $query->where('subscriber_id', $userId);
    }

    public function scopeForCreator($query, int $creatorId)
    {
        return $query->where('creator_id', $creatorId);
    }
}
