<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaxRate extends Model
{
    use HasFactory;

    /** Note on a 0% row for a country whose rate has not been confirmed. */
    public const UNCONFIRMED_NOTE = 'No rate on file. Confirm the rate before charging VAT.';

    protected $fillable = [
        'country_code',
        'country_name',
        'tax_name',
        'standard_rate_percentage',
        'wht_rate_percentage',
        'stream_rates',
        'is_active',
        'tax_number_format',
        'notes',
    ];

    protected $casts = [
        'standard_rate_percentage' => 'decimal:2',
        'wht_rate_percentage' => 'decimal:2',
        'stream_rates' => 'array',
        'is_active' => 'boolean',
    ];

    public function revenueEntries(): HasMany
    {
        return $this->hasMany(RevenueStreamEntry::class);
    }
}
