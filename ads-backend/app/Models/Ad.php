<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ad extends Model
{
    public function adGroup()
    {
        return $this->belongsTo(AdGroup::class);
    }
    
    public function metrics()
    {
        return $this->hasMany(AdMetric::class);
    }
}
