<?php

namespace App\Services;

use App\Models\Media;
use App\Models\User;
use Aws\S3\S3Client;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DirectStorageUploadService
{
    private const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25MB
    private const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
    private const MAX_OTHER_SIZE = 100 * 1024 * 1024; // 100MB

    public function __construct(
        private readonly StorageRouter $router,
    ) {}

    public function createPresignedUpload(
        User $user,
        string $filename,
        string $mimeType,
        int $sizeBytes,
        ?string $folder = 'uploads',
        ?string $ownerType = null,
        ?int $ownerId = null
    ): array {
        $this->validateSize($mimeType, $sizeBytes);

        $target = $this->router->resolve($mimeType, $folder);
        $disk = $target['disk'];
        $resolvedFolder = $target['folder'];

        $uuid = (string) Str::uuid();
        $ext = pathinfo($filename, PATHINFO_EXTENSION);
        $sanitizedExt = $ext ? '.' . strtolower($ext) : '';
        $safeFilename = Str::slug(pathinfo($filename, PATHINFO_FILENAME)) . $sanitizedExt;

        $path = sprintf('%s/%s/%s/%s/%s', rtrim($resolvedFolder, '/'), date('Y'), date('m'), $uuid, $safeFilename);

        $mediaType = match (true) {
            str_starts_with($mimeType, 'video/') => Media::TYPE_VIDEO,
            str_starts_with($mimeType, 'image/') => Media::TYPE_IMAGE,
            str_starts_with($mimeType, 'audio/') => Media::TYPE_AUDIO,
            default => Media::TYPE_DOCUMENT,
        };

        $diskConfig = config("filesystems.disks.{$disk}");
        if (! $diskConfig) {
            $disk = 'contabo';
            $diskConfig = config("filesystems.disks.{$disk}");
        }

        $presignedUrl = null;
        $uploadMode = 'direct_s3';

        if (($diskConfig['driver'] ?? '') === 's3') {
            $presignedUrl = $this->generateS3PresignedUrl($disk, $path, $mimeType);
        }

        // If local disk or presigned URL couldn't be generated, fallback to direct API endpoint
        if (! $presignedUrl) {
            $uploadMode = 'api_direct';
            $presignedUrl = url("/api/v1/media/upload-direct/{$uuid}");
        }

        $publicUrl = Storage::disk($disk)->url($path);

        $media = Media::create([
            'uuid' => $uuid,
            'user_id' => $user->id,
            'owner_type' => $ownerType,
            'owner_id' => $ownerId,
            'disk' => $disk,
            'folder' => $resolvedFolder,
            'filename' => $safeFilename,
            'original_name' => $filename,
            'path' => $path,
            'url' => $publicUrl,
            'mime_type' => $mimeType,
            'media_type' => $mediaType,
            'size_bytes' => $sizeBytes,
            'processing_status' => Media::STATUS_PENDING_UPLOAD,
        ]);

        return [
            'media' => $media,
            'upload_mode' => $uploadMode,
            'upload_url' => $presignedUrl,
            'headers' => [
                'Content-Type' => $mimeType,
            ],
            'expires_in_seconds' => 1800,
        ];
    }

    private function generateS3PresignedUrl(string $disk, string $path, string $mimeType): ?string
    {
        try {
            $adapter = Storage::disk($disk)->getAdapter();
            if (! method_exists($adapter, 'getClient')) {
                return null;
            }

            /** @var S3Client $client */
            $client = $adapter->getClient();
            $bucket = config("filesystems.disks.{$disk}.bucket");

            $cmd = $client->getCommand('PutObject', [
                'Bucket' => $bucket,
                'Key' => $path,
                'ContentType' => $mimeType,
            ]);

            $request = $client->createPresignedRequest($cmd, '+30 minutes');
            return (string) $request->getUri();
        } catch (\Throwable $e) {
            report($e);
            return null;
        }
    }

    private function validateSize(string $mimeType, int $sizeBytes): void
    {
        $max = match (true) {
            str_starts_with($mimeType, 'video/') => self::MAX_VIDEO_SIZE,
            str_starts_with($mimeType, 'image/') => self::MAX_IMAGE_SIZE,
            default => self::MAX_OTHER_SIZE,
        };

        if ($sizeBytes > $max) {
            $maxMb = (int) ($max / 1024 / 1024);
            throw new \InvalidArgumentException("File size exceeds maximum allowed limit of {$maxMb}MB.");
        }
    }
}
