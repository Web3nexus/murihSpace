<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Advertiser extends Model
{
    protected $fillable = [
        'murihspace_user_id',
        'business_name',
        'business_type',
        'country',
        'currency',
        'timezone',
        'verification_status',
        'risk_status',
        'account_status',
    ];
}