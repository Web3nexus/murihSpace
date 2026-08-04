<?php

namespace App\Http\Controllers;

use App\Console\Commands\ExpireRetainedMedia;
use App\Models\Media;
use App\Models\MediaRetentionHold;
use App\Services\MediaRetentionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminMediaRetentionController extends Controller
{
    public function show(MediaRetentionService $retention): JsonResponse
    {
        return response()->json([
            'data' => [
                'config' => $retention->config(),
                'stats' => [
                    'available' => (int) Media::where('lifecycle_status', 'available')->count(),
                    'pending_deletion' => (int) Media::where('lifecycle_status', 'scheduled_for_deletion')->count(),
                    'held' => (int) Media::where('lifecycle_status', 'held')->count(),
                    'expired' => (int) Media::where('lifecycle_status', 'deleted')->count(),
                    'active_holds' => (int) MediaRetentionHold::where('status', 'active')->count(),
                    'deletion_failures_24h' => (int) DB::table('media_retention_logs')
                        ->where('event', 'failed')
                        ->where('created_at', '>=', now()->subDay())
                        ->count(),
                ],
            ],
        ]);
    }

    public function update(Request $request, MediaRetentionService $retention): JsonResponse
    {
        $validated = $request->validate([
            'default_retention_days' => ['required', 'integer', 'min:1'],
            'max_retention_days' => ['required', 'integer', 'min:1'],
            'enable_automatic_deletion' => ['sometimes', 'boolean'],
            'enable_user_download_warning' => ['sometimes', 'boolean'],
            'warning_days' => ['sometimes', 'integer', 'min:0'],
            'batch_size' => ['sometimes', 'integer', 'min:1'],
            'schedule_time' => ['sometimes', 'string', 'max:5'],
            'retention_by_type' => ['sometimes', 'array'],
            'retention_by_type.*' => ['nullable', 'integer', 'min:1'],
            'holds' => ['sometimes', 'array'],
            'deletion_failure_alerts' => ['sometimes', 'boolean'],
        ]);

        $config = $retention->updateConfig($validated, $request->user());

        return response()->json([
            'message' => 'Media retention settings updated.',
            'data' => $config,
        ]);
    }

    public function runNow(MediaRetentionService $retention): JsonResponse
    {
        if (! $retention->config()['enable_automatic_deletion']) {
            return response()->json(['message' => 'Automatic deletion is disabled.'], 422);
        }

        $exit = Artisan::call(ExpireRetainedMedia::class, ['--limit' => $retention->config()['batch_size']]);

        if ($exit !== 0) {
            return response()->json(['message' => 'Retention run failed.'], 500);
        }

        return response()->json([
            'message' => 'Retention run completed.',
            'data' => ['output' => Artisan::output()],
        ]);
    }

    public function holds(): JsonResponse
    {
        $holds = MediaRetentionHold::with(['media.user:id,username,name', 'placedBy:id,username,name'])
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json([
            'data' => $holds,
        ]);
    }

    public function placeHold(Request $request, MediaRetentionService $retention): JsonResponse
    {
        $validated = $request->validate([
            'media_id' => ['required', 'integer', 'exists:media,id'],
            'hold_type' => ['required', 'string', Rule::in(MediaRetentionService::HOLD_TYPES)],
            'reason' => ['nullable', 'string', 'max:1000'],
            'case_ref' => ['nullable', 'string', 'max:255'],
            'expires_at' => ['nullable', 'date'],
        ]);

        $media = Media::findOrFail((int) $validated['media_id']);
        $hold = $retention->placeHold($media, $validated, $request->user());

        return response()->json([
            'message' => 'Hold placed on media.',
            'data' => $hold->fresh('media'),
        ], 201);
    }

    public function releaseHold(Request $request, MediaRetentionService $retention, MediaRetentionHold $hold): JsonResponse
    {
        abort_if($hold->status !== 'active', 422, 'Hold is not active.');

        $media = $retention->releaseHold($hold, $request->user());

        return response()->json([
            'message' => 'Hold released.',
            'data' => [
                'media' => $media,
                'expired' => $media->expired_at !== null,
            ],
        ]);
    }

    public function logs(): JsonResponse
    {
        $logs = DB::table('media_retention_logs')
            ->leftJoin('media', 'media.id', '=', 'media_retention_logs.media_id')
            ->select(
                'media_retention_logs.*',
                'media.original_name',
                'media.mime_type',
                'media.user_id',
            )
            ->orderByDesc('media_retention_logs.id')
            ->paginate(30);

        return response()->json([
            'data' => $logs,
        ]);
    }
}
