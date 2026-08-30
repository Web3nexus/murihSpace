<?php

namespace App\Jobs;

use App\Models\Media;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProcessVideoHlsJob implements ShouldQueue
{
    use Queueable;

    public int $timeout = 1800; // 30 minutes for large videos
    public int $tries = 3;

    private string $tmpDir;

    public function __construct(
        public Media $media,
    ) {}

    public function handle(): void
    {
        $media = $this->media->fresh();
        if (! $media || $media->media_type !== Media::TYPE_VIDEO) {
            return;
        }

        $media->update(['processing_status' => Media::STATUS_PROCESSING]);

        $disk = Storage::disk($media->disk);
        $this->tmpDir = storage_path("app/tmp/media-worker/{$media->uuid}");

        if (! is_dir($this->tmpDir)) {
            mkdir($this->tmpDir, 0755, true);
        }

        $localSource = $this->tmpDir . '/source.' . (pathinfo($media->filename, PATHINFO_EXTENSION) ?: 'mp4');

        try {
            // 1. Download source from Storage (S3/Contabo) to local temp
            $stream = $disk->readStream($media->path);
            if (! $stream) {
                throw new \RuntimeException("Could not open read stream for media path: {$media->path}");
            }
            $destStream = fopen($localSource, 'w+b');
            stream_copy_to_stream($stream, $destStream);
            fclose($stream);
            fclose($destStream);

            if (! file_exists($localSource) || filesize($localSource) === 0) {
                throw new \RuntimeException("Failed to download media file to local temp path: {$localSource}");
            }

            // 2. Probe video metadata
            $meta = $this->probeVideoMetadata($localSource);
            $width = $meta['width'] ?? 1280;
            $height = $meta['height'] ?? 720;
            $duration = $meta['duration'] ?? 0.0;

            // 3. Extract Thumbnail Poster Frame
            $localThumb = $this->tmpDir . '/thumbnail.jpg';
            $this->extractThumbnail($localSource, $localThumb);
            $remoteThumbPath = sprintf('videos/%s/thumbnail.jpg', $media->uuid);
            if (file_exists($localThumb)) {
                $disk->put($remoteThumbPath, file_get_contents($localThumb), 'public');
            }

            // 4. Process HLS Stream & Variants
            $hlsDir = $this->tmpDir . '/hls';
            if (! is_dir($hlsDir)) {
                mkdir($hlsDir, 0755, true);
            }

            $variantsConfig = $this->determineVariants($width, $height);
            $renderedVariants = [];

            foreach ($variantsConfig as $label => $config) {
                $variantPlaylist = "{$label}.m3u8";
                $success = $this->generateHlsVariant($localSource, $hlsDir, $label, $variantPlaylist, $config);
                if ($success) {
                    $renderedVariants[$label] = $config;
                }
            }

            // 5. Generate Master Playlist
            $masterPlaylistPath = $hlsDir . '/master.m3u8';
            $this->generateMasterPlaylist($masterPlaylistPath, $renderedVariants);

            // 6. Upload HLS Bundle to Contabo Storage
            $remoteHlsDir = sprintf('videos/%s/hls', $media->uuid);
            $this->uploadDirectoryToDisk($hlsDir, $disk, $remoteHlsDir);

            $masterRemotePath = "{$remoteHlsDir}/master.m3u8";

            // 7. Update Media record
            $media->update([
                'processing_status' => Media::STATUS_COMPLETED,
                'processing_error' => null,
                'width' => $width,
                'height' => $height,
                'duration_seconds' => $duration,
                'thumbnail_path' => file_exists($localThumb) ? $remoteThumbPath : null,
                'hls_playlist_path' => $masterRemotePath,
                'variants' => array_keys($renderedVariants),
                'metadata' => array_merge($media->metadata ?? [], [
                    'probe' => $meta,
                    'hls_variants' => array_keys($renderedVariants),
                ]),
            ]);

            Log::info("ProcessVideoHlsJob completed successfully for media UUID: {$media->uuid}");
        } catch (\Throwable $e) {
            Log::error("ProcessVideoHlsJob failed for media UUID {$media->uuid}: " . $e->getMessage());
            $media->update([
                'processing_status' => Media::STATUS_FAILED,
                'processing_error' => $e->getMessage(),
            ]);
            throw $e;
        } finally {
            $this->cleanTemp();
        }
    }

    public function failed(\Throwable $exception): void
    {
        $this->media->refresh();
        $this->media->update([
            'processing_status' => Media::STATUS_FAILED,
            'processing_error' => 'FFmpeg processing failed: ' . $exception->getMessage(),
        ]);
        $this->cleanTemp();
    }

    private function probeVideoMetadata(string $file): array
    {
        $ffprobeBin = env('FFPROBE_PATH', 'ffprobe');
        $cmd = sprintf(
            '%s -v quiet -print_format json -show_format -show_streams %s',
            escapeshellarg($ffprobeBin),
            escapeshellarg($file)
        );

        $output = shell_exec($cmd);
        if ($output) {
            $json = json_decode($output, true);
            if (is_array($json)) {
                $duration = (float) ($json['format']['duration'] ?? 0);
                $videoStream = collect($json['streams'] ?? [])->firstWhere('codec_type', 'video');
                $width = (int) ($videoStream['width'] ?? 0);
                $height = (int) ($videoStream['height'] ?? 0);

                if ($width > 0 && $height > 0) {
                    return [
                        'width' => $width,
                        'height' => $height,
                        'duration' => $duration,
                        'format' => $json['format']['format_name'] ?? 'mp4',
                    ];
                }
            }
        }

        // Fallback using ffmpeg -i info if ffprobe output is empty
        $ffmpegBin = env('FFMPEG_PATH', 'ffmpeg');
        $infoCmd = sprintf('%s -i %s 2>&1', escapeshellarg($ffmpegBin), escapeshellarg($file));
        $infoOutput = shell_exec($infoCmd) ?? '';

        preg_match('/Duration: (\d+):(\d+):(\d+\.\d+)/', $infoOutput, $durMatch);
        $durSec = 0.0;
        if ($durMatch) {
            $durSec = ($durMatch[1] * 3600) + ($durMatch[2] * 60) + (float) $durMatch[3];
        }

        preg_match('/, (\d{3,4})x(\d{3,4})/', $infoOutput, $dimMatch);
        $w = $dimMatch ? (int) $dimMatch[1] : 1280;
        $h = $dimMatch ? (int) $dimMatch[2] : 720;

        return [
            'width' => $w,
            'height' => $h,
            'duration' => $durSec,
        ];
    }

    private function extractThumbnail(string $source, string $dest): void
    {
        $ffmpegBin = env('FFMPEG_PATH', 'ffmpeg');
        $cmd = sprintf(
            '%s -y -ss 00:00:01 -i %s -vframes 1 -q:v 2 %s 2>&1',
            escapeshellarg($ffmpegBin),
            escapeshellarg($source),
            escapeshellarg($dest)
        );
        shell_exec($cmd);
    }

    private function determineVariants(int $origW, int $origH): array
    {
        $all = [
            '1080p' => ['width' => 1920, 'height' => 1080, 'bitrate' => '4000k', 'audio_bitrate' => '128k'],
            '720p'  => ['width' => 1280, 'height' => 720,  'bitrate' => '2200k', 'audio_bitrate' => '128k'],
            '480p'  => ['width' => 854,  'height' => 480,  'bitrate' => '1000k', 'audio_bitrate' => '96k'],
        ];

        $variants = [];
        foreach ($all as $label => $spec) {
            if ($origH >= $spec['height'] || $origW >= $spec['width'] || empty($variants)) {
                $variants[$label] = $spec;
            }
        }

        return $variants ?: ['480p' => $all['480p']];
    }

    private function generateHlsVariant(string $source, string $hlsDir, string $label, string $playlist, array $config): bool
    {
        $ffmpegBin = env('FFMPEG_PATH', 'ffmpeg');
        $segmentPattern = "{$hlsDir}/segment_{$label}_%03d.ts";
        $playlistPath = "{$hlsDir}/{$playlist}";

        $cmd = sprintf(
            '%s -y -i %s -vf "scale=w=%d:h=%d:force_original_aspect_ratio=decrease" -c:v libx264 -b:v %s -crf 22 -preset fast -g 48 -keyint_min 48 -sc_threshold 0 -c:a aac -b:a %s -hls_time 6 -hls_playlist_type vod -hls_segment_filename %s %s 2>&1',
            escapeshellarg($ffmpegBin),
            escapeshellarg($source),
            $config['width'],
            $config['height'],
            $config['bitrate'],
            $config['audio_bitrate'],
            escapeshellarg($segmentPattern),
            escapeshellarg($playlistPath)
        );

        shell_exec($cmd);

        return file_exists($playlistPath) && filesize($playlistPath) > 0;
    }

    private function generateMasterPlaylist(string $masterPath, array $variants): void
    {
        $content = "#EXTM3U\n#EXT-X-VERSION:3\n";

        foreach ($variants as $label => $spec) {
            $bandwidth = match ($label) {
                '1080p' => 4500000,
                '720p' => 2500000,
                default => 1100000,
            };
            $content .= sprintf(
                "#EXT-X-STREAM-INF:BANDWIDTH=%d,RESOLUTION=%dx%d\n%s.m3u8\n",
                $bandwidth,
                $spec['width'],
                $spec['height'],
                $label
            );
        }

        file_put_contents($masterPath, $content);
    }

    private function uploadDirectoryToDisk(string $localDir, $disk, string $remoteDir): void
    {
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($localDir));

        foreach ($files as $file) {
            if ($file->isDir()) continue;

            $relativePath = ltrim(str_replace($localDir, '', $file->getPathname()), '/');
            $remotePath = "{$remoteDir}/{$relativePath}";

            $contentType = str_ends_with($relativePath, '.m3u8') ? 'application/x-mpegURL' : 'video/MP2T';

            $disk->put($remotePath, file_get_contents($file->getPathname()), [
                'visibility' => 'public',
                'ContentType' => $contentType,
                'CacheControl' => 'public, max-age=31536000',
            ]);
        }
    }

    private function cleanTemp(): void
    {
        if (isset($this->tmpDir) && is_dir($this->tmpDir)) {
            $files = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($this->tmpDir, \RecursiveDirectoryIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::CHILD_FIRST
            );
            foreach ($files as $fileinfo) {
                $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
                @$todo($fileinfo->getRealPath());
            }
            @rmdir($this->tmpDir);
        }
    }
}
