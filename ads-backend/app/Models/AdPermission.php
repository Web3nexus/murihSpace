<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdPermission extends Model
{
    protected $fillable = [
        'advertiser_id',
        'creator_user_id',
        'status',
    ];

    public function advertiser()
    {
        return $this->belongsTo(Advertiser::class);
    }
}
