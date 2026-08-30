<?php

namespace App\Http\Controllers;

use App\Models\Media;
use App\Services\DirectStorageUploadService;
use App\Services\MediaProcessingService;
use App\Services\StorageRouter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    public function __construct(
        private readonly StorageRouter $router,
        private readonly DirectStorageUploadService $directUploadService,
        private readonly MediaProcessingService $processingService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Media::where('user_id', $request->user()->id);

        if ($request->has('type')) {
            $query->where('media_type', $request->input('type'));
        }

        $media = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($media);
    }

    public function createSignedUploadUrl(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'filename' => ['required', 'string', 'max:255'],
            'mime_type' => ['required', 'string', 'max:127'],
            'size_bytes' => ['required', 'integer', 'min:1'],
            'folder' => ['nullable', 'string', 'max:100'],
            'owner_type' => ['nullable', 'string', 'max:100'],
            'owner_id' => ['nullable', 'integer'],
        ]);

        try {
            $res = $this->directUploadService->createPresignedUpload(
                user: $request->user(),
                filename: $validated['filename'],
                mimeType: $validated['mime_type'],
                sizeBytes: $validated['size_bytes'],
                folder: $validated['folder'] ?? 'uploads',
                ownerType: $validated['owner_type'] ?? null,
                ownerId: $validated['owner_id'] ?? null,
            );

            return response()->json($res);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Failed to generate signed upload URL: ' . $e->getMessage()], 500);
        }
    }

    public function completeUpload(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'media_uuid' => ['required', 'string'],
        ]);

        $media = Media::where('uuid', $validated['media_uuid'])
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $updated = $this->processingService->markUploadComplete($media);

        return response()->json($updated);
    }

    public function showByUuid(Request $request, string $uuid): JsonResponse
    {
        $media = Media::where('uuid', $uuid)->firstOrFail();

        if ($media->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            abort(403);
        }

        return response()->json($media);
    }

    public function statusByUuid(Request $request, string $uuid): JsonResponse
    {
        $media = Media::where('uuid', $uuid)->firstOrFail();

        if ($media->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            abort(403);
        }

        return response()->json([
            'uuid' => $media->uuid,
            'processing_status' => $media->processing_status,
            'processing_error' => $media->processing_error,
            'stream_url' => $media->stream_url,
            'thumbnail_url' => $media->thumbnail_url,
            'url' => $media->url,
            'is_ready' => $media->isCompleted(),
        ]);
    }

    public function retryProcessing(Request $request, string $uuid): JsonResponse
    {
        $media = Media::where('uuid', $uuid)->firstOrFail();

        if ($media->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            abort(403);
        }

        $media = $this->processingService->retryProcessing($media);

        return response()->json($media);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => [
                'required',
                'file',
                'mimes:jpeg,png,gif,webp,svg,avif,pdf,mp4,webm',
                'max:51200',
            ],
            'folder' => ['nullable', 'string', 'max:100'],
        ]);

        $file = $request->file('file');
        $mime = $file->getMimeType();

        $target = $this->router->resolve($mime, $request->input('folder'));
        $disk = $target['disk'];
        $folder = $target['folder'];

        $diskConfig = config("filesystems.disks.{$disk}");
        if (! $diskConfig) {
            $disk = 'contabo';
        }

        $filename = Str::random(32) . '.' . ($file->getClientOriginalExtension() ?: 'bin');
        $path = ltrim($folder . '/' . $filename, '/');

        $stored = Storage::disk($disk)->put($path, file_get_contents($file->getRealPath()), [
            'visibility' => 'public',
            'ContentType' => $mime,
            'CacheControl' => 'public, max-age=86400',
        ]);

        if (! $stored) {
            return response()->json(['message' => 'Failed to store file.'], 500);
        }

        $url = Storage::disk($disk)->url($path);

        $media = Media::create([
            'user_id' => $request->user()->id,
            'disk' => $disk,
            'folder' => $folder,
            'filename' => $filename,
            'original_name' => $file->getClientOriginalName(),
            'path' => $path,
            'url' => $url,
            'mime_type' => $mime,
            'size_bytes' => $file->getSize(),
            'processing_status' => Media::STATUS_QUEUED,
        ]);

        $this->processingService->dispatchProcessingJob($media);

        return response()->json($media, 201);
    }

    public function destroy(Request $request, Media $media): JsonResponse
    {
        if ($media->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            abort(403);
        }

        $this->processingService->deleteMedia($media);

        return response()->json(['message' => 'File deleted.']);
    }
}
