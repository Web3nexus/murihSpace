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

    // AdController::index eager-loads this; the column already exists (ads.creative_id).
    public function creative()
    {
        return $this->belongsTo(Creative::class);
    }
}
