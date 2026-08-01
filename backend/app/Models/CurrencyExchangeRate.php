<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CurrencyExchangeRate extends Model
{
    public const UPDATED_AT = 'updated_at';
    public const CREATED_AT = null;

    protected $fillable = [
        'from_currency', 'to_currency', 'rate',
    ];

    protected $casts = [
        'rate' => 'decimal:6',
    ];
}
