<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdConversion extends Model
{
    protected $fillable = [
        'ad_id',
        'user_id',
        'type',
        'value',
        'reference_id',
    ];

    public function ad()
    {
        return $this->belongsTo(Ad::class);
    }
}
