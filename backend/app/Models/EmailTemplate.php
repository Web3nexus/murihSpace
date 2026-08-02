<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailTemplate extends Model
{
    protected $fillable = ['key', 'name', 'description', 'subject', 'body_html', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public static function for(string $key): ?self
    {
        return static::where('key', $key)->where('is_active', true)->first();
    }
}
