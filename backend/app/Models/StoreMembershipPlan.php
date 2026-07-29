<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoreMembershipPlan extends Model
{
    protected $fillable = ['creator_id', 'name', 'description', 'price', 'currency', 'interval', 'trial_days', 'status', 'subscriber_count'];

    protected $casts = ['price' => 'decimal:2', 'trial_days' => 'integer', 'subscriber_count' => 'integer'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }
}
