<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PixelEvent extends Model
{
    protected $fillable = [
        'pixel_uuid',
        'event_type',
        'user_identifier',
        'event_data'
    ];

    protected $casts = [
        'event_data' => 'array',
    ];

    public function pixel()
    {
        return $this->belongsTo(Pixel::class, 'pixel_uuid', 'pixel_uuid');
    }
}
