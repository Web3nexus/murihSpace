<?php

namespace App\Http\Controllers;

use App\Models\Media;
use App\Services\MediaProcessingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminMediaController extends Controller
{
    public function __construct(
        private readonly MediaProcessingService $processingService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Media::with('user:id,name,email,username')
            ->orderBy('created_at', 'desc');

        if ($type = $request->input('media_type')) {
            $query->where('media_type', $type);
        }

        if ($status = $request->input('status')) {
            $query->where('processing_status', $status);
        }

        if ($disk = $request->input('disk')) {
            $query->where('disk', $disk);
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('original_name', 'like', "%{$search}%")
                    ->orWhere('filename', 'like', "%{$search}%")
                    ->orWhere('uuid', 'like', "%{$search}%");
            });
        }

        $media = $query->paginate($request->input('per_page', 20));

        return response()->json($media);
    }

    public function stats(): JsonResponse
    {
        $totalMedia = Media::count();
        $totalStorageBytes = (int) Media::sum('size_bytes');

        $byType = Media::select('media_type', DB::raw('count(*) as count'), DB::raw('sum(size_bytes) as total_size'))
            ->groupBy('media_type')
            ->get()
            ->keyBy('media_type');

        $byStatus = Media::select('processing_status', DB::raw('count(*) as count'))
            ->groupBy('processing_status')
            ->get()
            ->pluck('count', 'processing_status');

        $byDisk = Media::select('disk', DB::raw('count(*) as count'), DB::raw('sum(size_bytes) as total_size'))
            ->groupBy('disk')
            ->get();

        return response()->json([
            'total_media_count' => $totalMedia,
            'total_storage_bytes' => $totalStorageBytes,
            'total_storage_formatted' => $this->formatBytes($totalStorageBytes),
            'by_type' => [
                'images' => $byType->get(Media::TYPE_IMAGE)['count'] ?? 0,
                'videos' => $byType->get(Media::TYPE_VIDEO)['count'] ?? 0,
                'audio' => $byType->get(Media::TYPE_AUDIO)['count'] ?? 0,
                'documents' => $byType->get(Media::TYPE_DOCUMENT)['count'] ?? 0,
            ],
            'by_status' => [
                'completed' => $byStatus->get(Media::STATUS_COMPLETED) ?? 0,
                'processing' => $byStatus->get(Media::STATUS_PROCESSING) ?? 0,
                'queued' => $byStatus->get(Media::STATUS_QUEUED) ?? 0,
                'pending_upload' => $byStatus->get(Media::STATUS_PENDING_UPLOAD) ?? 0,
                'failed' => $byStatus->get(Media::STATUS_FAILED) ?? 0,
            ],
            'by_disk' => $byDisk,
        ]);
    }

    public function retry(string $uuid): JsonResponse
    {
        $media = Media::where('uuid', $uuid)->firstOrFail();
        $updated = $this->processingService->retryProcessing($media);

        return response()->json($updated);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $media = Media::where('uuid', $uuid)->firstOrFail();
        $this->processingService->deleteMedia($media);

        return response()->json(['message' => 'Media deleted permanently.']);
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes <= 0) return '0 B';
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = (int) floor(log($bytes, 1024));
        return round($bytes / pow(1024, $i), 2) . ' ' . $units[$i];
    }
}
