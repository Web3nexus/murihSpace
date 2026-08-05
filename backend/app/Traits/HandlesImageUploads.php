<?php

namespace App\Traits;

use App\Jobs\ProcessUploadedImage;
use App\Models\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

trait HandlesImageUploads
{
    public function uploadImage(Request $request, string $folder = 'images', string $visibility = 'private'): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'image', 'mimes:jpeg,png,gif,webp,avif', 'max:10240'],
        ]);

        $file = $request->file('file');
        $disk = config('filesystems.upload_disk', 'local_uploads');
        $filename = Str::random(32) . '.' . $file->getClientOriginalExtension();
        $path = ltrim($folder . '/' . $filename, '/');

        $diskConfig = config("filesystems.disks.{$disk}");
        if ($diskConfig['driver'] === 'local') {
            $root = $diskConfig['root'] ?? public_path('storage/uploads');
            $dir = dirname("{$root}/{$path}");
            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
        }

        Storage::disk($disk)->put($path, file_get_contents($file->getRealPath()), [
            'visibility' => $visibility,
            'ContentType' => $file->getMimeType(),
            'CacheControl' => $visibility === 'public' ? 'public, max-age=86400' : 'private, max-age=3600',
        ]);
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
            'metadata' => ['upload_type' => $folder],
        ]);

        dispatch(new ProcessUploadedImage($media));

        return response()->json(['data' => $media], 201);
    }

    public function deleteImage(Media $media, Request $request): JsonResponse
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

        return response()->json(['message' => 'Image deleted.']);
    }
}
