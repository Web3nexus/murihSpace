<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Country extends Model
{
    protected $primaryKey = 'iso2';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'iso2',
        'iso3',
        'name',
        'calling_code',
        'flag',
        'currency',
        'state_required',
        'postal_code_required',
    ];

    protected $casts = [
        'state_required' => 'boolean',
        'postal_code_required' => 'boolean',
    ];

    public function states(): HasMany
    {
        return $this->hasMany(State::class, 'country_iso2', 'iso2');
    }
}
