<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Campaign extends Model
{
    protected $guarded = [];

    public function advertiser()
    {
        return $this->belongsTo(Advertiser::class);
    }
}
