<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RevenueStreamEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'reference',
        'stream_type',
        'source_system',
        'source_id',
        'currency',
        'gross_amount_cents',
        'platform_fee_cents',
        'creator_vendor_amount_cents',
        'gateway_fee_cents',
        'tax_amount_cents',
        'net_platform_revenue_cents',
        'country_code',
        'tax_rate_applied',
        'tax_type',
        'tax_rate_id',
        'metadata',
    ];

    protected $casts = [
        'gross_amount_cents' => 'integer',
        'platform_fee_cents' => 'integer',
        'creator_vendor_amount_cents' => 'integer',
        'gateway_fee_cents' => 'integer',
        'tax_amount_cents' => 'integer',
        'net_platform_revenue_cents' => 'integer',
        'tax_rate_applied' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function taxRate(): BelongsTo
    {
        return $this->belongsTo(TaxRate::class);
    }
}
