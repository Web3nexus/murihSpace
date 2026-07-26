<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserMilestone extends Model
{
    protected $fillable = [
        'user_id', 'milestone_id', 'progress', 'achieved_at',
    ];

    protected $casts = [
        'progress' => 'integer',
        'achieved_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(Milestone::class);
    }

    public function isAchieved(): bool
    {
        return $this->achieved_at !== null;
    }
}
