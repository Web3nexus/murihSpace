<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class State extends Model
{
    protected $fillable = [
        'country_iso2',
        'code',
        'name',
    ];

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'country_iso2', 'iso2');
    }
}
