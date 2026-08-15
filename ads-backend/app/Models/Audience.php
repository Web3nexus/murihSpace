<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Audience extends Model
{
    protected $fillable = [
        'advertiser_id',
        'name',
        'type',
        'source_audience_id',
        'status',
        'size',
        'rules'
    ];

    protected $casts = [
        'rules' => 'array',
    ];

    public function advertiser()
    {
        return $this->belongsTo(Advertiser::class);
    }

    public function sourceAudience()
    {
        return $this->belongsTo(Audience::class, 'source_audience_id');
    }

    public function users()
    {
        return $this->hasMany(AudienceUser::class);
    }
}
