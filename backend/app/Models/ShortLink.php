<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ShortLink extends Model
{
    protected $fillable = ['user_id', 'code', 'resource_type', 'resource_id', 'target_url', 'title', 'is_active', 'clicks'];

    protected $casts = ['is_active' => 'boolean', 'clicks' => 'integer'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function generateCode(int $length = 6): string
    {
        $code = Str::random($length);
        while (static::where('code', $code)->exists()) {
            $code = Str::random($length);
        }
        return $code;
    }

    public function recordClick(): void
    {
        $this->increment('clicks');
    }
}
