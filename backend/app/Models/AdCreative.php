<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AdCreative extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'campaign_id', 'user_id', 'headline', 'description',
        'cta_text', 'destination_url', 'media_url', 'media_type', 'status',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(AdCampaign::class, 'campaign_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function promotable()
    {
        return $this->morphTo();
    }
}
