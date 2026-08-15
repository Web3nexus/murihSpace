<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Support\Str;

class Pixel extends Model
{
    protected $fillable = [
        'advertiser_id',
        'name',
        'pixel_uuid'
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->pixel_uuid)) {
                $model->pixel_uuid = (string) Str::uuid();
            }
        });
    }

    public function advertiser()
    {
        return $this->belongsTo(Advertiser::class);
    }

    public function events()
    {
        return $this->hasMany(PixelEvent::class, 'pixel_uuid', 'pixel_uuid');
    }
}
