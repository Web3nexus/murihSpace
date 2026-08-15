<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AudienceUser extends Model
{
    protected $fillable = [
        'audience_id',
        'user_identifier',
    ];

    public function audience()
    {
        return $this->belongsTo(Audience::class);
    }
}
