<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeeConfiguration extends Model
{
    protected $fillable = [
        'fee_type',
        'name',
        'percentage',
        'flat_fee',
        'currency',
        'is_active',
        'description',
    ];

    protected $casts = [
        'percentage' => 'float',
        'flat_fee' => 'integer',
        'is_active' => 'boolean',
    ];
}
