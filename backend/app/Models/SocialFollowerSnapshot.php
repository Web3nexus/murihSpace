<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SocialFollowerSnapshot extends Model
{
    protected $fillable = [
        'user_id',
        'combined_followers',
        'provider_breakdown',
        'threshold_at_time',
        'captured_at',
    ];

    protected $casts = [
        'combined_followers' => 'integer',
        'provider_breakdown' => 'array',
        'threshold_at_time'  => 'integer',
        'captured_at'        => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function qualificationEvent(): HasOne
    {
        return $this->hasOne(CreatorQualificationEvent::class, 'snapshot_id');
    }
}
