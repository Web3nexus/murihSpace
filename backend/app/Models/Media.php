<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Media extends Model
{
    public const LIFECYCLE_UPLOADED = 'uploaded';
    public const LIFECYCLE_SCANNING = 'scanning';
    public const LIFECYCLE_AVAILABLE = 'available';
    public const LIFECYCLE_SCHEDULED = 'scheduled_for_deletion';
    public const LIFECYCLE_DELETED = 'deleted';
    public const LIFECYCLE_HELD = 'held';
    public const LIFECYCLE_RESTORED = 'restored';

    protected $fillable = [
        'user_id', 'disk', 'folder', 'filename', 'original_name',
        'path', 'url', 'mime_type', 'size_bytes', 'metadata',
        'reference_count', 'last_referenced_at',
        'delete_after', 'lifecycle_status', 'retention_hold', 'held_until', 'expired_at',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'reference_count' => 'integer',
        'last_referenced_at' => 'datetime',
        'metadata' => 'array',
        'delete_after' => 'datetime',
        'held_until' => 'datetime',
        'expired_at' => 'datetime',
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

    public function retentionHolds()
    {
        return $this->hasMany(MediaRetentionHold::class);
    }

    public function isExpired(): bool
    {
        return $this->lifecycle_status === self::LIFECYCLE_DELETED || $this->expired_at !== null;
    }

    public function isRetained(): bool
    {
        return $this->lifecycle_status === self::LIFECYCLE_AVAILABLE
            || $this->lifecycle_status === self::LIFECYCLE_SCANNING
            || $this->lifecycle_status === self::LIFECYCLE_SCHEDULED;
    }

    public function scopeEligibleForDeletion($query)
    {
        return $query->whereNotNull('delete_after')
            ->where('delete_after', '<=', now())
            ->whereIn('lifecycle_status', [self::LIFECYCLE_AVAILABLE, self::LIFECYCLE_SCHEDULED]);
    }

    public function scopeExpiringWithin($query, int $days)
    {
        return $query->whereNotNull('delete_after')
            ->whereBetween('delete_after', [now(), now()->addDays($days)])
            ->whereIn('lifecycle_status', [self::LIFECYCLE_AVAILABLE, self::LIFECYCLE_SCHEDULED]);
    }

    public function scopeExpired($query)
    {
        return $query->where('lifecycle_status', self::LIFECYCLE_DELETED);
    }

    public function scopeHeld($query)
    {
        return $query->where('lifecycle_status', self::LIFECYCLE_HELD);
    }

    public function scopeAwaitingDeletion($query)
    {
        return $query->where('lifecycle_status', self::LIFECYCLE_SCHEDULED);
    }
}
