<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FeeRule extends Model
{
    public const FEE_TYPES = ['fixed', 'percentage', 'fixed_plus_percentage', 'tiered'];

    protected $fillable = [
        'name',
        'code',
        'description',
        'fee_type',
        'fixed_amount',
        'percentage',
        'minimum_fee',
        'maximum_fee',
        'currency',
        'country',
        'role',
        'wallet_type',
        'transaction_type',
        'payment_method',
        'tiered_rates',
        'effective_from',
        'effective_until',
        'enabled',
        'priority',
    ];

    protected $casts = [
        'fixed_amount'    => 'integer',
        'percentage'      => 'float',
        'minimum_fee'     => 'integer',
        'maximum_fee'     => 'integer',
        'tiered_rates'    => 'array',
        'enabled'         => 'boolean',
        'priority'        => 'integer',
        'effective_from'  => 'datetime',
        'effective_until' => 'datetime',
    ];

    /**
     * Active fee rules scope — enabled, date range valid, ordered by priority.
     */
    public function scopeActive(Builder $query): Builder
    {
        $now = now();

        return $query->where('enabled', true)
            ->where(function ($q) use ($now) {
                $q->whereNull('effective_from')->orWhere('effective_from', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('effective_until')->orWhere('effective_until', '>=', $now);
            })
            ->orderBy('priority', 'desc');
    }
}
