<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SlaPolicy extends Model
{
    use HasFactory;

    public const PERIOD_LABELS = [
        'remaining' => 'On track',
        'paused' => 'Paused',
        'breached' => 'Breached',
        'completed' => 'Completed',
    ];

    public const PERIOD_STYLES = [
        'remaining' => 'bg-[#38A8D8]/10 text-[#1b6a8f]',
        'paused' => 'bg-[#F5B94E]/15 text-[#9a6b00]',
        'breached' => 'bg-[#DC2626]/10 text-[#B42318]',
        'completed' => 'bg-[#16A34A]/10 text-[#15803D]',
    ];

    protected $fillable = [
        'name', 'description', 'priority',
        'first_response_target', 'next_response_target', 'resolution_target',
        'business_hours', 'weekends', 'holidays', 'holiday_dates',
        'pause_on_customer', 'enabled', 'created_by',
    ];

    protected $casts = [
        'first_response_target' => 'integer',
        'next_response_target' => 'integer',
        'resolution_target' => 'integer',
        'business_hours' => 'boolean',
        'weekends' => 'boolean',
        'holidays' => 'boolean',
        'holiday_dates' => 'array',
        'pause_on_customer' => 'boolean',
        'enabled' => 'boolean',
    ];

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(StaffUser::class, 'created_by');
    }

    public function holidayDates(): array
    {
        return array_values(array_filter(
            array_map(fn ($d) => (string) $d, $this->holiday_dates ?? []),
        ));
    }
}
