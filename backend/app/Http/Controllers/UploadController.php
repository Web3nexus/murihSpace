<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessUploadedImage;
use App\Models\Media;
use App\Services\StorageRouter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    private const ALLOWED_MIMES = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'image/svg+xml', 'image/avif',
        'application/pdf',
        'video/mp4', 'video/webm',
    ];

    private const MAX_SIZE = 50 * 1024 * 1024; // 50MB

    public function __construct(
        private readonly StorageRouter $router,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $media = Media::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->get(['id', 'url', 'original_name', 'mime_type', 'size_bytes', 'created_at']);

        return response()->json(['data' => $media]);
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
            return response()->json(['message' => "Storage disk '{$disk}' not configured."], 500);
        }

        $filename = Str::random(32) . '.' . $file->getClientOriginalExtension();
        $path = ltrim($folder . '/' . $filename, '/');

        $stored = Storage::disk($disk)->put($path, file_get_contents($file->getRealPath()));

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
        ]);

        if (str_starts_with($mime, 'image/')) {
            dispatch(new ProcessUploadedImage($media));
        }

        return response()->json(['data' => $media], 201);
    }

    public function destroy(Request $request, Media $media): JsonResponse
    {
        if ($media->user_id !== $request->user()->id) {
            abort(403);
        }

        Storage::disk($media->disk)->delete($media->path);

        $thumbDir = dirname($media->path) . '/thumbnails';
        $filename = pathinfo($media->filename, PATHINFO_FILENAME);
        $ext = pathinfo($media->filename, PATHINFO_EXTENSION);

        foreach (['320', '640'] as $size) {
            $thumb = "{$thumbDir}/{$filename}_{$size}.{$ext}";
            if (Storage::disk($media->disk)->exists($thumb)) {
                Storage::disk($media->disk)->delete($thumb);
            }
        }

        $webpPath = dirname($media->path) . '/' . $filename . '.webp';
        if (Storage::disk($media->disk)->exists($webpPath)) {
            Storage::disk($media->disk)->delete($webpPath);
        }

        $media->delete();

        return response()->json(['message' => 'File deleted.']);
    }
}
