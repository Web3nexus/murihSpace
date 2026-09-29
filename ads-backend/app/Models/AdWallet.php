<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdWallet extends Model
{
    protected $fillable = [
        'advertiser_id',
        'currency',
        'available_balance',
        'reserved_balance',
        'lifetime_spend',
    ];
}
