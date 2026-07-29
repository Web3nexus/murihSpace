<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketingCampaign extends Model
{
    protected $fillable = ['creator_id', 'name', 'type', 'status', 'sent_count', 'open_count', 'click_count'];

    protected $casts = ['sent_count' => 'integer', 'open_count' => 'integer', 'click_count' => 'integer'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }
}
