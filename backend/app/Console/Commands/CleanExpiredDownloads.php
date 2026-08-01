<?php

namespace App\Console\Commands;

use App\Models\Purchase;
use App\Services\StorageRouter;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class CleanExpiredDownloads extends Command
{
    protected $signature = 'downloads:clean {--days=30 : Age in days after which to expire downloads}';
    protected $description = 'Remove expired download links and orphaned download files';

    public function handle(StorageRouter $router): int
    {
        $days = (int) $this->option('days');
        $cutoff = Carbon::now()->subDays($days);

        $expired = Purchase::whereDate('last_downloaded_at', '<', $cutoff)
            ->orWhereNull('last_downloaded_at')
            ->where('created_at', '<', $cutoff)
            ->update(['download_count' => 0]);

        $this->info("Revoked download access for {$expired} purchases.");

        $disk = Storage::disk($router->privateDisk());
        $orphanedDir = 'downloads/tmp';
        $count = 0;

        if ($disk->exists($orphanedDir)) {
            foreach ($disk->files($orphanedDir) as $file) {
                $lastModified = Carbon::createFromTimestamp($disk->lastModified($file));
                if ($lastModified->lt($cutoff)) {
                    $disk->delete($file);
                    $count++;
                }
            }
        }

        $this->info("Cleaned up {$count} orphaned temporary files.");

        return Command::SUCCESS;
    }
}
