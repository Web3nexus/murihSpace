<?php

namespace App\Http\Controllers;

use App\Models\Media;
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
        $folder = $request->input('folder', config('filesystems.upload_folder', 'uploads'));
        $disk = config('filesystems.upload_disk', 'local_uploads');
        $diskConfig = config("filesystems.disks.{$disk}");

        if (! $diskConfig) {
            return response()->json(['message' => 'Upload disk not configured.'], 500);
        }

        $filename = Str::random(32) . '.' . $file->getClientOriginalExtension();
        $path = ltrim($folder . '/' . $filename, '/');

        // For local disk, ensure directory exists
        if ($diskConfig['driver'] === 'local') {
            $root = $diskConfig['root'] ?? public_path('storage/uploads');
            $dir = dirname("{$root}/{$path}");
            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
        }

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
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
        ]);

        return response()->json(['data' => $media], 201);
    }

    public function destroy(Request $request, Media $media): JsonResponse
    {
        if ($media->user_id !== $request->user()->id) {
            abort(403);
        }

        Storage::disk($media->disk)->delete($media->path);
        $media->delete();

        return response()->json(['message' => 'File deleted.']);
    }
}
