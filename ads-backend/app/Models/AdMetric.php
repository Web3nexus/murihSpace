<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdMetric extends Model
{
    protected $fillable = ['ad_id', 'date', 'impressions', 'clicks', 'spend'];

    public function ad()
    {
        return $this->belongsTo(Ad::class);
    }
}
