<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class Media extends Model
{
    public const LIFECYCLE_UPLOADED = 'uploaded';
    public const LIFECYCLE_SCANNING = 'scanning';
    public const LIFECYCLE_AVAILABLE = 'available';
    public const LIFECYCLE_SCHEDULED = 'scheduled_for_deletion';
    public const LIFECYCLE_DELETED = 'deleted';
    public const LIFECYCLE_HELD = 'held';
    public const LIFECYCLE_RESTORED = 'restored';

    // Processing Statuses
    public const STATUS_PENDING_UPLOAD = 'pending_upload';
    public const STATUS_UPLOADED = 'uploaded';
    public const STATUS_QUEUED = 'queued';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_DELETED = 'deleted';

    // Media Types
    public const TYPE_IMAGE = 'image';
    public const TYPE_VIDEO = 'video';
    public const TYPE_AUDIO = 'audio';
    public const TYPE_DOCUMENT = 'document';

    protected $fillable = [
        'uuid', 'user_id', 'owner_type', 'owner_id', 'disk', 'folder', 'filename', 'original_name',
        'path', 'url', 'mime_type', 'media_type', 'size_bytes', 'width', 'height', 'duration_seconds',
        'processing_status', 'processing_error', 'thumbnail_path', 'hls_playlist_path', 'variants',
        'metadata', 'reference_count', 'last_referenced_at',
        'delete_after', 'lifecycle_status', 'retention_hold', 'held_until', 'expired_at',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
        'duration_seconds' => 'float',
        'reference_count' => 'integer',
        'last_referenced_at' => 'datetime',
        'metadata' => 'array',
        'variants' => 'array',
        'delete_after' => 'datetime',
        'held_until' => 'datetime',
        'expired_at' => 'datetime',
    ];

    protected $appends = [
        'stream_url',
        'thumbnail_url',
    ];

    protected static function booted(): void
    {
        static::creating(function (Media $media) {
            if (empty($media->uuid)) {
                $media->uuid = (string) Str::uuid();
            }
            if (empty($media->media_type) && ! empty($media->mime_type)) {
                $media->media_type = match (true) {
                    str_starts_with($media->mime_type, 'video/') => self::TYPE_VIDEO,
                    str_starts_with($media->mime_type, 'image/') => self::TYPE_IMAGE,
                    str_starts_with($media->mime_type, 'audio/') => self::TYPE_AUDIO,
                    default => self::TYPE_DOCUMENT,
                };
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    public function getStreamUrlAttribute(): ?string
    {
        if (! empty($this->hls_playlist_path)) {
            return $this->getPublicUrlForPath($this->hls_playlist_path);
        }

        return $this->url;
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        if (! empty($this->thumbnail_path)) {
            return $this->getPublicUrlForPath($this->thumbnail_path);
        }

        return null;
    }

    public function getPublicUrlForPath(string $path): string
    {
        try {
            return Storage::disk($this->disk)->url($path);
        } catch (\Throwable) {
            return rtrim(config('filesystems.disks.contabo.url', env('APP_URL')), '/') . '/' . ltrim($path, '/');
        }
    }

    public function isCompleted(): bool
    {
        return $this->processing_status === self::STATUS_COMPLETED;
    }

    public function isProcessing(): bool
    {
        return in_array($this->processing_status, [self::STATUS_QUEUED, self::STATUS_PROCESSING], true);
    }

    public function isFailed(): bool
    {
        return $this->processing_status === self::STATUS_FAILED;
    }

    public function messages(): \Illuminate\Database\Eloquent\Relations\HasMany
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
        if ($this->reference_count > 0) {
            $this->decrement('reference_count');
        }
    }

    public function scopeEligibleForDeletion($query)
    {
        return $query->whereIn('lifecycle_status', [self::LIFECYCLE_AVAILABLE, self::LIFECYCLE_SCHEDULED])
            ->where('delete_after', '<=', now())
            ->whereNull('retention_hold');
    }

    public function scopeExpiringWithin($query, int $days)
    {
        return $query->whereIn('lifecycle_status', [self::LIFECYCLE_AVAILABLE, self::LIFECYCLE_SCHEDULED])
            ->whereNull('retention_hold')
            ->whereBetween('delete_after', [now(), now()->addDays($days)]);
    }

    public function scopeCompleted($query)
    {
        return $query->where('processing_status', self::STATUS_COMPLETED);
    }

    public function scopeProcessing($query)
    {
        return $query->whereIn('processing_status', [self::STATUS_QUEUED, self::STATUS_PROCESSING]);
    }

    public function scopeFailed($query)
    {
        return $query->where('processing_status', self::STATUS_FAILED);
    }
}
