<?php

namespace App\Http\Controllers;

use App\Models\Media;
use App\Models\Message;
use App\Services\StorageQuotaService;
use App\Services\StorageRouter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MessageAttachmentController extends Controller
{
    private string $attachmentDisk;

    public function __construct(
        private readonly StorageRouter $router,
        private readonly StorageQuotaService $quota,
    ) {
        $this->attachmentDisk = config('filesystems.upload_disk', 'local_uploads');
    }

    public function upload(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,pdf,doc,docx,txt,mp3,mp4,mov,zip,csv,xlsx,pptx'],
            'client_uuid' => ['nullable', 'string', 'max:64'],
        ]);

        $clientUuid = $validated['client_uuid'] ?? null;

        if ($clientUuid) {
            $existing = Media::where('metadata->client_uuid', $clientUuid)
                ->where('user_id', $request->user()->id)
                ->first();
            if ($existing) {
                return $this->mediaResponse($existing);
            }
        }

        $file = $validated['file'];
        $mimeType = $file->getMimeType();
        $size = $file->getSize();

        $quotaError = $this->quota->checkUserQuota($request->user(), $file);
        if ($quotaError !== null) {
            return response()->json(['message' => $quotaError], 403);
        }

        $target = $this->router->resolve($mimeType, 'message_attachments');
        $disk = $target['disk'];

        $diskConfig = config("filesystems.disks.{$disk}");
        if (! $diskConfig) {
            return response()->json(['message' => "Storage disk '{$disk}' not configured."], 500);
        }

        $folder = 'message_attachments';
        $ext = $file->getClientOriginalExtension();
        $filename = Str::random(32) . '.' . $ext;
        $path = ltrim($folder . '/' . $filename, '/');

        $stored = Storage::disk($disk)->put($path, file_get_contents($file->getRealPath()));
        if (! $stored) {
            return response()->json(['message' => 'Failed to store file.'], 500);
        }

        $url = Storage::disk($disk)->url($path);

        try {
            $media = Media::create([
                'user_id' => $request->user()->id,
                'disk' => $disk,
                'folder' => $folder,
                'filename' => $filename,
                'original_name' => $file->getClientOriginalName(),
                'path' => $path,
                'url' => $url,
                'mime_type' => $mimeType,
                'size_bytes' => $size,
                'metadata' => array_filter(['client_uuid' => $clientUuid]),
            ]);
        } catch (\Throwable $e) {
            Storage::disk($disk)->delete($path);
            throw $e;
        }

        $attachmentType = match (true) {
            str_starts_with($mimeType, 'image/') => 'image',
            str_starts_with($mimeType, 'audio/') => 'voice',
            default => 'file',
        };

        return response()->json([
            'data' => [
                'media_id' => $media->id,
                'attachment_url' => $url,
                'attachment_type' => $attachmentType,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $mimeType,
                'size' => $size,
            ],
        ], 201);
    }

    private function mediaResponse(Media $media): JsonResponse
    {
        $attachmentType = match (true) {
            str_starts_with($media->mime_type, 'image/') => 'image',
            str_starts_with($media->mime_type, 'audio/') => 'voice',
            default => 'file',
        };

        return response()->json([
            'data' => [
                'media_id' => $media->id,
                'attachment_url' => $media->url,
                'attachment_type' => $attachmentType,
                'original_name' => $media->original_name,
                'mime_type' => $media->mime_type,
                'size' => $media->size_bytes,
            ],
        ]);
    }
}
