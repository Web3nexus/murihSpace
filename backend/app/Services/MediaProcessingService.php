<?php

namespace App\Services;

use App\Jobs\ProcessUploadedImage;
use App\Jobs\ProcessVideoHlsJob;
use App\Models\Media;
use Illuminate\Support\Facades\Storage;

class MediaProcessingService
{
    public function __construct(
        private readonly FileSecurityFilterService $securityFilter,
    ) {}

    public function markUploadComplete(Media $media): Media
    {
        $disk = Storage::disk($media->disk);

        if (! $disk->exists($media->path)) {
            $media->update([
                'processing_status' => Media::STATUS_FAILED,
                'processing_error' => 'File not found on storage destination after upload.',
            ]);
            return $media;
        }

        // Security scan before approval / queueing
        $tmpDir = storage_path('app/tmp/security-scans');
        if (! is_dir($tmpDir)) {
            mkdir($tmpDir, 0755, true);
        }
        $tmpSample = $tmpDir . '/' . $media->uuid . '.bin';

        try {
            // Read up to 2MB to verify security signatures
            $stream = $disk->readStream($media->path);
            if ($stream) {
                $sampleData = fread($stream, 2 * 1024 * 1024);
                fclose($stream);
                file_put_contents($tmpSample, $sampleData);

                $this->securityFilter->validateExistingFile(
                    $tmpSample,
                    $media->original_name ?? $media->filename,
                    $media->mime_type
                );
            }
        } catch (\Throwable $e) {
            // Malicious or invalid file: remove from disk immediately
            if ($disk->exists($media->path)) {
                $disk->delete($media->path);
            }
            if (file_exists($tmpSample)) {
                @unlink($tmpSample);
            }

            $media->update([
                'processing_status' => Media::STATUS_FAILED,
                'processing_error' => 'Security policy violation: ' . $e->getMessage(),
            ]);

            return $media;
        } finally {
            if (file_exists($tmpSample)) {
                @unlink($tmpSample);
            }
        }

        $size = $disk->size($media->path);
        $media->update([
            'size_bytes' => $size ?: $media->size_bytes,
            'processing_status' => Media::STATUS_QUEUED,
            'processing_error' => null,
        ]);

        $this->dispatchProcessingJob($media);

        return $media;
    }

    public function retryProcessing(Media $media): Media
    {
        $media->update([
            'processing_status' => Media::STATUS_QUEUED,
            'processing_error' => null,
        ]);

        $this->dispatchProcessingJob($media);

        return $media;
    }

    public function dispatchProcessingJob(Media $media): void
    {
        if ($media->media_type === Media::TYPE_VIDEO) {
            dispatch(new ProcessVideoHlsJob($media))->onQueue('media-processing');
        } elseif ($media->media_type === Media::TYPE_IMAGE) {
            dispatch(new ProcessUploadedImage($media))->onQueue('media-processing');
        } else {
            $media->update([
                'processing_status' => Media::STATUS_COMPLETED,
            ]);
        }
    }

    public function deleteMedia(Media $media): void
    {
        $disk = Storage::disk($media->disk);

        // Delete main path
        if ($disk->exists($media->path)) {
            $disk->delete($media->path);
        }

        // Delete thumbnail if exists
        if ($media->thumbnail_path && $disk->exists($media->thumbnail_path)) {
            $disk->delete($media->thumbnail_path);
        }

        // Delete HLS directory if video
        if ($media->hls_playlist_path) {
            $hlsDir = dirname($media->hls_playlist_path);
            if ($disk->exists($hlsDir)) {
                $disk->deleteDirectory($hlsDir);
            }
        }

        $media->update([
            'processing_status' => Media::STATUS_DELETED,
            'lifecycle_status' => Media::LIFECYCLE_DELETED,
        ]);

        $media->delete();
    }
}
