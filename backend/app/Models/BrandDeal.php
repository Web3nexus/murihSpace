<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BrandDeal extends Model
{
    protected $fillable = [
        'creator_id', 'brand_id', 'title', 'description',
        'deal_type', 'status', 'budget', 'currency',
        'deliverables', 'starts_at', 'ends_at',
    ];

    protected $casts = [
        'budget' => 'integer',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public const DEAL_TYPES = ['sponsored_post', 'affiliate', 'collaboration', 'event', 'other'];

    public const STATUSES = ['pending', 'negotiating', 'active', 'completed', 'cancelled'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(BrandInvoice::class);
    }
}
