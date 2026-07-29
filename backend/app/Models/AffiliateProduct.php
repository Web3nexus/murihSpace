<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AffiliateProduct extends Model
{
    protected $fillable = ['creator_id', 'name', 'url', 'commission_rate', 'clicks', 'conversions', 'revenue', 'is_active'];

    protected $casts = ['commission_rate' => 'integer', 'clicks' => 'integer', 'conversions' => 'integer', 'revenue' => 'decimal:2', 'is_active' => 'boolean'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }
}
