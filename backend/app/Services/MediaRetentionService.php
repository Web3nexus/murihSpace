<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\AuditLog;
use App\Models\Media;
use App\Models\MediaRetentionHold;
use App\Models\Message;
use App\Models\Report;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Server-side chat media retention.
 *
 * Message records are always preserved; only the underlying media objects are
 * removed after the configured retention window. Physical deletion is permanent
 * and non-retrievable, so legal, dispute, order, moderation, reconciliation and
 * business-rule holds are always re-checked immediately before deletion.
 *
 * All timings are administrator-controlled (admin_settings key: media_retention)
 * and never hardcoded.
 */
class MediaRetentionService
{
    public const SETTING_KEY = 'media_retention';

    public const MEDIA_TYPES = ['image', 'video', 'voice', 'file', 'gif'];

    public const HOLD_TYPES = [
        'dispute',
        'order',
        'moderation',
        'legal',
        'reconciliation',
        'business_rule',
        'malware_review',
    ];

    /**
     * Effective retention configuration, merging runtime admin settings over
     * the file-backed defaults in config/mediaretention.php.
     */
    public function config(): array
    {
        $defaults = config('mediaretention');
        $raw = AdminSetting::get(self::SETTING_KEY);
        $stored = $raw !== null && $raw !== '' ? json_decode((string) $raw, true) : null;

        if (! is_array($stored)) {
            return $defaults;
        }

        return array_merge($defaults, [
            'default_retention_days' => (int) ($stored['default_retention_days'] ?? $defaults['default_retention_days']),
            'max_retention_days' => (int) ($stored['max_retention_days'] ?? $defaults['max_retention_days']),
            'enable_automatic_deletion' => (bool) ($stored['enable_automatic_deletion'] ?? $defaults['enable_automatic_deletion']),
            'enable_user_download_warning' => (bool) ($stored['enable_user_download_warning'] ?? $defaults['enable_user_download_warning']),
            'warning_days' => (int) ($stored['warning_days'] ?? $defaults['warning_days']),
            'batch_size' => (int) ($stored['batch_size'] ?? $defaults['batch_size']),
            'schedule_time' => (string) ($stored['schedule_time'] ?? $defaults['schedule_time']),
            'retention_by_type' => array_merge($defaults['retention_by_type'], is_array($stored['retention_by_type'] ?? null) ? $stored['retention_by_type'] : []),
            'holds' => array_merge($defaults['holds'], is_array($stored['holds'] ?? null) ? $stored['holds'] : []),
            'deletion_failure_alerts' => (bool) ($stored['deletion_failure_alerts'] ?? $defaults['deletion_failure_alerts']),
        ]);
    }

    /**
     * Validate + persist a new retention configuration, writing an audit record.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateConfig(array $data, User $actor): array
    {
        $cfg = $this->config();

        $defaultDays = (int) ($data['default_retention_days'] ?? $cfg['default_retention_days']);
        $maxDays = (int) ($data['max_retention_days'] ?? $cfg['max_retention_days']);

        if ($defaultDays < 1) {
            throw ValidationException::withMessages([
                'default_retention_days' => ['Retention must be at least 1 day.'],
            ]);
        }
        if ($maxDays < 1 || $maxDays < $defaultDays) {
            throw ValidationException::withMessages([
                'max_retention_days' => ['The maximum retention period must be at least the default period.'],
            ]);
        }
        if (($data['batch_size'] ?? null) !== null && (int) $data['batch_size'] < 1) {
            throw ValidationException::withMessages([
                'batch_size' => ['Deletion batch size must be at least 1.'],
            ]);
        }

        $byType = [];
        foreach (self::MEDIA_TYPES as $type) {
            $value = $data['retention_by_type'][$type] ?? null;
            $byType[$type] = $value === null || $value === '' ? null : max(1, (int) $value);
        }

        $holds = $cfg['holds'];
        foreach (array_keys($cfg['holds']) as $key) {
            if (array_key_exists($key, $data['holds'] ?? [])) {
                $holds[$key] = (bool) $data['holds'][$key];
            }
        }

        $config = [
            'default_retention_days' => $defaultDays,
            'max_retention_days' => $maxDays,
            'enable_automatic_deletion' => (bool) ($data['enable_automatic_deletion'] ?? $cfg['enable_automatic_deletion']),
            'enable_user_download_warning' => (bool) ($data['enable_user_download_warning'] ?? $cfg['enable_user_download_warning']),
            'warning_days' => max(0, (int) ($data['warning_days'] ?? $cfg['warning_days'])),
            'batch_size' => (int) ($data['batch_size'] ?? $cfg['batch_size']),
            'schedule_time' => (string) ($data['schedule_time'] ?? $cfg['schedule_time']),
            'retention_by_type' => $byType,
            'holds' => $holds,
            'deletion_failure_alerts' => (bool) ($data['deletion_failure_alerts'] ?? $cfg['deletion_failure_alerts']),
        ];

        AdminSetting::set(self::SETTING_KEY, json_encode($config));

        AuditLog::create([
            'user_id' => $actor->id,
            'action' => 'media_retention.updated',
            'resource_type' => 'media_retention',
            'resource_id' => null,
            'metadata' => ['config' => $config, 'changed_by' => $actor->username ?: $actor->email],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return $config;
    }

    /**
     * Retention window in days for a given attachment type.
     */
    public function retentionDaysFor(string $type): int
    {
        $cfg = $this->config();
        $overrides = $cfg['retention_by_type'];
        $normalized = in_array($type, self::MEDIA_TYPES, true) ? $type : 'file';

        if (is_numeric($overrides[$normalized] ?? null) && (int) $overrides[$normalized] > 0) {
            $days = (int) $overrides[$normalized];
        } else {
            $days = (int) $cfg['default_retention_days'];
        }

        return min($days, (int) $cfg['max_retention_days']);
    }

    /**
     * Map a storage/attachment type onto the retention bucket types.
     */
    public function normalizeType(string $type): string
    {
        return match (strtolower($type)) {
            'audio', 'voice' => 'voice',
            'gif' => 'gif',
            'video' => 'video',
            'image' => 'image',
            'file', 'document', 'application', 'default' => 'file',
            default => 'file',
        };
    }

    /**
     * The exact time after which a freshly-uploaded media object should expire.
     */
    public function deleteAfterFor(string $type, Carbon $uploadedAt): Carbon
    {
        return $uploadedAt->copy()->addDays($this->retentionDaysFor($type));
    }

    /**
     * Transition media from the temporary scanning state to fully available.
     */
    public function markAvailable(Media $media): void
    {
        if ($media->lifecycle_status === 'available' || $media->lifecycle_status === 'held') {
            return;
        }

        $media->forceFill(['lifecycle_status' => 'available'])->save();
    }

    /**
     * Schedule a freshly uploaded media object for deletion.
     */
    public function applyToUpload(Media $media, string $type, bool $scanning = false): void
    {
        $deleteAfter = $this->deleteAfterFor($type, $media->created_at ?? now());

        $media->forceFill([
            'delete_after' => $deleteAfter,
            'lifecycle_status' => $scanning ? 'scanning' : 'available',
            'expired_at' => null,
        ])->save();

        $this->log($media, null, 'scheduled', "Media scheduled for deletion after {$deleteAfter->toIso8601String()}");
    }

    /**
     * Active hold protecting this media from deletion, or null.
     *
     * @return array{type: string, case_ref: string|null, expires_at: string|null}|null
     */
    public function activeHoldFor(Media $media): ?array
    {
        $cfg = $this->config();

        // Explicit holds (dispute, order, legal, reconciliation, business rule, malware review).
        $hold = MediaRetentionHold::where('media_id', $media->id)
            ->where('status', 'active')
            ->orderBy('id')
            ->first();

        if ($hold) {
            return [
                'type' => $hold->hold_type,
                'case_ref' => $hold->case_ref,
                'expires_at' => $hold->expires_at?->toIso8601String(),
            ];
        }

        // Automatic moderation hold: the media is attached to a message that is
        // the subject of an open moderation report. If the media has no linked
        // message rows yet, any pending message report is treated as a hold so
        // deletion is deferred until moderation clears it.
        if (! empty($cfg['holds']['reported'])) {
            $messageIds = $media->messages()->pluck('messages.id');
            $reported = Report::whereIn('reported_type', ['message'])
                ->whereIn('status', ['pending', 'reviewed'])
                ->where(function ($query) use ($messageIds): void {
                    $query->whereIn('reported_id', $messageIds);

                    if ($messageIds->isEmpty()) {
                        $query->orWhereRaw('1 = 1');
                    }
                })
                ->exists();

            if ($reported) {
                return ['type' => 'moderation', 'case_ref' => null, 'expires_at' => null];
            }
        }

        return null;
    }

    public function hasHold(Media $media): bool
    {
        return $this->activeHoldFor($media) !== null;
    }

    /**
     * Place an explicit hold on a media object.
     *
     * @param  array<string, mixed>  $data
     */
    public function placeHold(Media $media, array $data, User $actor): MediaRetentionHold
    {
        $hold = MediaRetentionHold::create([
            'media_id' => $media->id,
            'hold_type' => $data['hold_type'],
            'reason' => $data['reason'] ?? null,
            'case_ref' => $data['case_ref'] ?? null,
            'placed_by' => $actor->id,
            'expires_at' => ! empty($data['expires_at']) ? Carbon::parse($data['expires_at']) : null,
            'status' => 'active',
        ]);

        $media->forceFill(['lifecycle_status' => 'held', 'retention_hold' => $hold->hold_type])->save();

        $this->log($media, null, 'held', $hold->reason ?? "Held for {$hold->hold_type}");

        return $hold;
    }

    public function releaseHold(MediaRetentionHold $hold, User $actor): Media
    {
        $media = $hold->media;

        $hold->update(['status' => 'released']);
        $media->forceFill([
            'lifecycle_status' => $media->delete_after && $media->delete_after->isPast() ? 'scheduled_for_deletion' : 'available',
            'retention_hold' => null,
            'held_until' => null,
        ])->save();

        $this->log($media, null, 'released', "Hold released by {$actor->username}");

        return $media;
    }

    /**
     * Permanently delete the media file (and derived artifacts) from object
     * storage and mark the media row as expired. The message history is kept.
     *
     * @return array{status: string, deleted: bool, held: ?string}
     */
    public function expire(Media $media, string $reason = 'retention_policy', bool $force = false): array
    {
        if ($media->lifecycle_status === 'deleted' && $media->expired_at) {
            return ['status' => 'already_deleted', 'deleted' => false, 'held' => null];
        }

        if (! $force) {
            $hold = $this->activeHoldFor($media);
            if ($hold) {
                return ['status' => 'held', 'deleted' => false, 'held' => $hold['type']];
            }
        }

        $deleted = false;
        try {
            $disk = Storage::disk($media->disk);
            $deleted = $disk->exists($media->path) ? $disk->delete($media->path) : true;

            $thumbDir = dirname($media->path).'/thumbnails';
            $filename = pathinfo($media->filename, PATHINFO_FILENAME);
            $ext = pathinfo($media->filename, PATHINFO_EXTENSION);

            foreach (['320', '640'] as $size) {
                $thumb = "{$thumbDir}/{$filename}_{$size}.{$ext}";
                if ($disk->exists($thumb)) {
                    $disk->delete($thumb);
                }
            }

            $webpPath = dirname($media->path).'/'.$filename.'.webp';
            if ($disk->exists($webpPath)) {
                $disk->delete($webpPath);
            }
        } catch (\Throwable $e) {
            $this->log($media, null, 'failed', 'Deletion failed: '.$e->getMessage());

            return ['status' => 'failed', 'deleted' => false, 'held' => null];
        }

        // Release storage usage accounting once the object is physically gone.
        try {
            $quota = app(StorageQuotaService::class);
            $quota->removeUsage('user', $media->user_id, $quota->classifyMimeType($media->mime_type), $media->size_bytes);
        } catch (\Throwable) {
            // quota accounting is best-effort; do not abort deletion
        }

        $media->forceFill([
            'lifecycle_status' => 'deleted',
            'retention_hold' => null,
            'expired_at' => now(),
        ])->save();

        $this->log($media, null, 'deleted', $reason);

        return ['status' => 'deleted', 'deleted' => true, 'held' => null];
    }

    /**
     * Public-facing expiry info serialized onto messages for the UI.
     */
    public function expirationInfo(Media $media): array
    {
        $expired = $media->lifecycle_status === 'deleted' || $media->expired_at !== null;
        $remainingDays = null;

        if (! $expired && $media->delete_after) {
            $remainingDays = max(0, (int) ceil(now()->diffInSeconds($media->delete_after) / 86400));
        }

        return [
            'lifecycle_status' => $media->lifecycle_status,
            'expired' => $expired,
            'expires_at' => $media->delete_after?->toIso8601String(),
            'expires_in_days' => $remainingDays,
            'warning_enabled' => (bool) $this->config()['enable_user_download_warning'],
            'retention_hold' => $media->retention_hold,
            'held_until' => $media->held_until?->toIso8601String(),
        ];
    }

    /**
     * Immutable audit row for a retention lifecycle transition.
     */
    public function log(Media $media, ?Message $message, string $event, string $reason = ''): void
    {
        DB::table('media_retention_logs')->insert([
            'media_id' => $media->id,
            'message_id' => $message?->id,
            'event' => $event,
            'reason' => $reason ?: null,
            'metadata' => json_encode(['disk' => $media->disk, 'path' => $media->path, 'size_bytes' => $media->size_bytes]),
            'created_at' => now(),
        ]);
    }

    public function logFailure(Media $media, string $reason): void
    {
        $this->log($media, null, 'failed', $reason);
    }

    /**
     * Media whose delete_after date has passed, oldest first, ready for the
     * next deletion batch.
     */
    public function expiredBatch(int $limit = 200)
    {
        return Media::eligibleForDeletion()
            ->orderBy('delete_after')
            ->limit($limit)
            ->get();
    }

    /**
     * Media expiring within the warning window whose participants have not yet
     * been notified (guarded by the expiry_notified retention log row).
     */
    public function expiringWarningBatch(int $warningDays, int $limit = 200)
    {
        return Media::expiringWithin($warningDays)
            ->whereNotExists(function ($query) {
                $query->selectRaw(1)
                    ->from('media_retention_logs')
                    ->whereColumn('media_retention_logs.media_id', 'media.id')
                    ->where('media_retention_logs.event', 'expiry_notified');
            })
            ->orderBy('delete_after')
            ->limit($limit)
            ->get();
    }
}
