<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Creative extends Model
{
    protected $fillable = [
        'advertiser_id',
        'type', // single_image, video, carousel, dynamic_product, boosted_post
        'assets',
        'status',
        'external_post_id'
    ];

    protected $casts = [
        'assets' => 'array',
    ];

    public function advertiser()
    {
        return $this->belongsTo(Advertiser::class);
    }
}
