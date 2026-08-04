<?php

namespace App\Jobs;

use App\Models\Media;
use App\Services\MediaRetentionService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use RuntimeException;

/**
 * Permanently deletes a single expired chat media object from storage.
 *
 * Idempotent: re-running against an already-expired media is a no-op, and the
 * retention holds are re-checked immediately before deletion so held media is
 * never removed by a stale job.
 */
class DeleteExpiredChatMedia implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [60, 300];

    public function __construct(
        public readonly int $mediaId,
    ) {}

    public function handle(MediaRetentionService $retention): void
    {
        $media = Media::find($this->mediaId);

        if (! $media) {
            return;
        }

        $result = $retention->expire($media, 'retention_policy');

        if ($result['status'] === 'held') {
            $retention->log($media, null, 'held', 'Skipped deletion because media is under an active hold ('.$result['held'].').');

            return;
        }

        if ($result['status'] === 'failed') {
            throw new RuntimeException('Media deletion failed for media #'.$media->id);
        }
    }

    public function failed(\Throwable $e): void
    {
        $media = Media::find($this->mediaId);

        if ($media) {
            app(MediaRetentionService::class)->logFailure($media, 'Deletion job failed: '.$e->getMessage());
        }

        report($e);
    }
}
