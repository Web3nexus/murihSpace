<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxLiability extends Model
{
    use HasFactory;

    protected $fillable = [
        'period_identifier',
        'period_start',
        'period_end',
        'country_code',
        'currency',
        'tax_type',
        'taxable_base_cents',
        'tax_collected_cents',
        'wht_withheld_cents',
        'status',
        'reported_by',
        'reported_at',
        'remitted_at',
        'filing_reference',
        'notes',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'taxable_base_cents' => 'integer',
        'tax_collected_cents' => 'integer',
        'wht_withheld_cents' => 'integer',
        'reported_at' => 'datetime',
        'remitted_at' => 'datetime',
    ];

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }
}
