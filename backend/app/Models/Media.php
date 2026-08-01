<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Media extends Model
{
    protected $fillable = [
        'user_id', 'disk', 'folder', 'filename', 'original_name',
        'path', 'url', 'mime_type', 'size_bytes', 'metadata',
        'reference_count', 'last_referenced_at',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'reference_count' => 'integer',
        'last_referenced_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }

    public function incrementReferenceCount(): void
    {
        $this->increment('reference_count');
        $this->update(['last_referenced_at' => now()]);
    }

    public function decrementReferenceCount(): void
    {
        $this->newQuery()
            ->whereKey($this->getKey())
            ->where('reference_count', '>', 0)
            ->decrement('reference_count');

        $this->refresh();
    }

    public function isReferenced(): bool
    {
        return $this->reference_count > 0;
    }

    public function isOrphaned(): bool
    {
        return $this->reference_count <= 0;
    }
}
