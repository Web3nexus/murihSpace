<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SoundTrack extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'artist',
        'audio_url',
        'cover_url',
        'duration',
        'category',
        'is_active',
    ];

    protected $casts = [
        'duration' => 'integer',
        'is_active' => 'boolean',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
