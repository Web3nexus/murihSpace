<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdAccount extends Model
{
    protected $fillable = [
        'advertiser_id',
        'name',
        'currency',
        'timezone',
        'status',
        'spending_limit',
        'daily_account_limit',
        'risk_level',
    ];
}
