<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BrandDealProposal extends Model
{
    protected $fillable = [
        'creator_id', 'brand_id', 'brand_name', 'brand_email',
        'title', 'pitch', 'proposed_budget', 'currency',
        'deliverables', 'status', 'sent_at',
    ];

    protected $casts = [
        'proposed_budget' => 'integer',
        'sent_at' => 'datetime',
    ];

    public const STATUSES = ['draft', 'sent', 'viewed', 'declined', 'accepted'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
