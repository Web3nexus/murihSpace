<?php

namespace App\Console\Commands;

use App\Models\Media;
use App\Services\StorageQuotaService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class CleanupOrphanedMedia extends Command
{
    protected $signature = 'media:cleanup-orphaned {--days=7 : Age in days after which to delete orphaned media}';
    protected $description = 'Permanently delete media files with no active references';

    public function handle(StorageQuotaService $quota): int
    {
        $days = (int) $this->option('days');
        $cutoff = Carbon::now()->subDays($days);

        $orphaned = Media::where('reference_count', '<=', 0)
            ->where('created_at', '<', $cutoff)
            ->get();

        $count = 0;
        $freed = 0;

        foreach ($orphaned as $media) {
            $disk = Storage::disk($media->disk);

            if ($disk->exists($media->path)) {
                $disk->delete($media->path);
            }

            $thumbDir = dirname($media->path) . '/thumbnails';
            $filename = pathinfo($media->filename, PATHINFO_FILENAME);
            $ext = pathinfo($media->filename, PATHINFO_EXTENSION);

            foreach (['320', '640'] as $size) {
                $thumb = "{$thumbDir}/{$filename}_{$size}.{$ext}";
                if ($disk->exists($thumb)) {
                    $disk->delete($thumb);
                }
            }

            $webpPath = dirname($media->path) . '/' . $filename . '.webp';
            if ($disk->exists($webpPath)) {
                $disk->delete($webpPath);
            }

            $mediaType = $quota->classifyMimeType($media->mime_type);
            $quota->removeUsage('user', $media->user_id, $mediaType, $media->size_bytes);

            $freed += $media->size_bytes;
            $media->delete();
            $count++;
        }

        $freedMb = round($freed / 1048576, 2);
        $this->info("Cleaned up {$count} orphaned media files ({$freedMb} MB freed).");

        return Command::SUCCESS;
    }
}
