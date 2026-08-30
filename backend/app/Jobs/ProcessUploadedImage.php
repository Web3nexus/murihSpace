<?php

namespace App\Jobs;

use App\Models\Media;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProcessUploadedImage implements ShouldQueue
{
    use Queueable;

    private string $tmpDir;

    public function __construct(
        public Media $media,
    ) {}

    public function handle(): void
    {
        if (! str_starts_with($this->media->mime_type, 'image/')) return;
        if (! extension_loaded('gd') && ! extension_loaded('imagick')) return;

        $disk = Storage::disk($this->media->disk);
        $this->tmpDir = storage_path('app/tmp/image-processing');

        $local = $this->downloadToTemp($disk);
        if (! $local) return;

        $info = @getimagesize($local);
        if (! $info) { $this->cleanTemp($local); return; }

        [$width, $height] = $info;

        $this->media->update([
            'processing_status' => Media::STATUS_PROCESSING,
        ]);

        $filename = pathinfo($this->media->filename, PATHINFO_FILENAME);
        $ext = strtolower(pathinfo($this->media->filename, PATHINFO_EXTENSION));
        $baseDir = dirname($this->media->path);

        $this->generateThumbnail($local, $disk, $baseDir, $filename, $ext, 320);
        $this->generateThumbnail($local, $disk, $baseDir, $filename, $ext, 640);

        if (in_array($ext, ['jpg', 'jpeg', 'png'])) {
            $this->convertToWebp($local, $disk, $baseDir, $filename);
        }

        $thumbPath = "{$baseDir}/thumbnails/{$filename}_320.{$ext}";

        $this->media->update([
            'width' => $width,
            'height' => $height,
            'processing_status' => Media::STATUS_COMPLETED,
            'thumbnail_path' => $disk->exists($thumbPath) ? $thumbPath : null,
            'metadata' => array_merge($this->media->metadata ?? [], [
                'width' => $width,
                'height' => $height,
            ]),
        ]);

        $this->cleanTemp($local);
    }

    private function downloadToTemp($disk): ?string
    {
        if (! is_dir($this->tmpDir)) {
            mkdir($this->tmpDir, 0755, true);
        }

        $tmpPath = $this->tmpDir . '/' . Str::random(40) . '.' . pathinfo($this->media->filename, PATHINFO_EXTENSION);

        try {
            $content = $disk->get($this->media->path);
            if ($content === null) return null;
            file_put_contents($tmpPath, $content);
            return $tmpPath;
        } catch (\Exception) {
            return null;
        }
    }

    private function cleanTemp(string $path): void
    {
        if (file_exists($path)) @unlink($path);
    }

    private function generateThumbnail(string $local, $disk, string $baseDir, string $filename, string $ext, int $size): void
    {
        $destPath = $this->tmpDir . "/thumb_{$filename}_{$size}.{$ext}";
        $this->resizeImage($local, $destPath, $size);

        if (file_exists($destPath)) {
            $remotePath = "{$baseDir}/thumbnails/{$filename}_{$size}.{$ext}";
            $disk->put($remotePath, file_get_contents($destPath));
            @unlink($destPath);
        }
    }

    private function convertToWebp(string $local, $disk, string $baseDir, string $filename): void
    {
        $destPath = $this->tmpDir . "/{$filename}.webp";

        $srcImg = $this->createImage($local);
        if (! $srcImg) return;

        imagewebp($srcImg, $destPath, 80);
        imagedestroy($srcImg);

        if (file_exists($destPath)) {
            $remotePath = "{$baseDir}/{$filename}.webp";
            $disk->put($remotePath, file_get_contents($destPath));
            @unlink($destPath);
        }
    }

    private function resizeImage(string $source, string $dest, int $maxSize): void
    {
        [$width, $height] = @getimagesize($source);
        if (! $width || ! $height) return;

        $ratio = min($maxSize / $width, $maxSize / $height, 1);
        $newW = (int) round($width * $ratio);
        $newH = (int) round($height * $ratio);

        if ($newW >= $width && $newH >= $height) {
            @copy($source, $dest);
            return;
        }

        $srcImg = $this->createImage($source);
        if (! $srcImg) return;

        $dstImg = imagecreatetruecolor($newW, $newH);
        imagealphablending($dstImg, false);
        imagesavealpha($dstImg, true);
        imagecopyresampled($dstImg, $srcImg, 0, 0, 0, 0, $newW, $newH, $width, $height);

        $ext = strtolower(pathinfo($dest, PATHINFO_EXTENSION));
        match ($ext) {
            'png' => imagepng($dstImg, $dest, 6),
            'gif' => imagegif($dstImg, $dest),
            'webp' => imagewebp($dstImg, $dest, 80),
            default => imagejpeg($dstImg, $dest, 80),
        };

        imagedestroy($srcImg);
        imagedestroy($dstImg);
    }

    private function createImage(string $path): \GdImage|false
    {
        return match (@exif_imagetype($path)) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($path),
            IMAGETYPE_PNG => @imagecreatefrompng($path),
            IMAGETYPE_GIF => @imagecreatefromgif($path),
            IMAGETYPE_WEBP => @imagecreatefromwebp($path),
            default => false,
        };
    }
}
