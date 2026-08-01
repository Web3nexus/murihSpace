<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiMemory extends Model
{
    protected $fillable = ['user_id', 'key', 'value'];

    protected $casts = [
        'value' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function remember(int $userId, string $key, mixed $value): void
    {
        self::updateOrCreate(
            ['user_id' => $userId, 'key' => $key],
            ['value' => $value],
        );
    }

    public static function recall(int $userId, string $key): mixed
    {
        return self::where('user_id', $userId)->where('key', $key)->value('value');
    }

    public static function recallAll(int $userId): array
    {
        return self::where('user_id', $userId)
            ->pluck('value', 'key')
            ->all();
    }
}
