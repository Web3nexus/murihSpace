<?php

namespace App\Console\Commands;

use App\Jobs\DeleteExpiredChatMedia;
use App\Jobs\NotifyMediaExpiry;
use App\Models\Media;
use App\Services\MediaRetentionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * Enforces the server-side chat media retention policy.
 *
 * - Permanently deletes media whose delete_after date has passed (in batches,
 *   dispatched to the queue as idempotent jobs).
 * - Notifies conversation participants about media expiring within the
 *   configured warning window.
 *
 * A distributed lock guarantees this routine never runs concurrently on
 * multiple queue/clock workers, so each media object is only processed once.
 */
class ExpireRetainedMedia extends Command
{
    protected $signature = 'media:expire-retained {--limit= : Override the configured deletion batch size}';

    protected $description = 'Enforce server media retention: delete expired chat media and send expiry warnings';

    public function handle(MediaRetentionService $retention): int
    {
        $config = $retention->config();

        if (! $config['enable_automatic_deletion']) {
            $this->info('Automatic media deletion is disabled; nothing to do.');

            return Command::SUCCESS;
        }

        $lock = Cache::lock('media:expire-retained', 3600);

        if (! $lock->get()) {
            $this->info('media:expire-retained is already running on another worker.');

            return Command::SUCCESS;
        }

        try {
            $limit = (int) ($this->option('limit') ?: $config['batch_size']);

            $deleted = 0;
            $skipped = 0;
            $held = 0;

            foreach ($retention->expiredBatch($limit) as $media) {
                if ($retention->hasHold($media)) {
                    $held++;
                    continue;
                }

                DeleteExpiredChatMedia::dispatch($media->id);
                $deleted++;
            }

            $this->info("Dispatched {$deleted} expired media for deletion; {$held} held; {$skipped} skipped.");

            if ($config['warning_days'] > 0) {
                $warned = 0;

                foreach ($retention->expiringWarningBatch($config['warning_days'], $limit) as $media) {
                    NotifyMediaExpiry::dispatch($media->id);
                    $warned++;
                }

                if ($warned) {
                    $this->info("Dispatched {$warned} expiry warnings within {$config['warning_days']} days.");
                }
            }

            return Command::SUCCESS;
        } finally {
            $lock->release();
        }
    }
}
