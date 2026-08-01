<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdAnalytics extends Model
{
    use HasFactory;

    protected $fillable = [
        'campaign_id', 'creative_id', 'date', 'impressions', 'reach', 'clicks',
        'reactions', 'comments', 'shares', 'follows', 'community_joins',
        'product_views', 'purchases', 'messages_received', 'video_views',
        'amount_spent',
    ];

    protected $casts = [
        'date' => 'date',
        'amount_spent' => 'decimal:2',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(AdCampaign::class, 'campaign_id');
    }
}
