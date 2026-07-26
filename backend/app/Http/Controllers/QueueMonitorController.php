<?php

namespace App\Http\Controllers;

use App\Models\LedgerEntry;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class QueueMonitorController extends Controller
{
    public function stats(): JsonResponse
    {
        $pending = DB::table('jobs')->count();
        $failed = DB::table('failed_jobs')->count();
        $processed = 0;
        $failedLastHour = 0;
        $byQueue = [];

        if (DB::connection()->getDriverName() === 'pgsql') {
            $byQueue = DB::table('jobs')
                ->select('queue', DB::raw('COUNT(*) as count'))
                ->groupBy('queue')
                ->pluck('count', 'queue')
                ->toArray();
        } else {
            $byQueue = DB::table('jobs')
                ->select('queue', DB::raw('count(*) as count'))
                ->groupBy('queue')
                ->pluck('count', 'queue')
                ->toArray();
        }

        $recentFailed = DB::table('failed_jobs')
            ->where('failed_at', '>=', now()->subHour())
            ->count();

        return response()->json(['data' => [
            'pending' => $pending,
            'failed' => $failed,
            'failed_last_hour' => $recentFailed,
            'by_queue' => $byQueue,
            'horizon_path' => '/horizon',
        ]]);
    }

    public function failedJobs(Request $request): JsonResponse
    {
        $perPage = min((int) $request->query('per_page', 20), 100);
        $jobs = DB::table('failed_jobs')
            ->orderBy('failed_at', 'desc')
            ->paginate($perPage);

        return response()->json(['data' => $jobs->items(), 'meta' => [
            'current_page' => $jobs->currentPage(),
            'last_page' => $jobs->lastPage(),
            'total' => $jobs->total(),
            'per_page' => $jobs->perPage(),
        ]]);
    }

    public function retryFailed(int $id): JsonResponse
    {
        $exitCode = Artisan::call('queue:retry', ['id' => [$id]]);
        if ($exitCode === 0) {
            return response()->json(['message' => 'Job requeued for retry.']);
        }
        return response()->json(['message' => 'Failed to retry job.'], 500);
    }

    public function retryAllFailed(): JsonResponse
    {
        $exitCode = Artisan::call('queue:retry', ['id' => ['all']]);
        if ($exitCode === 0) {
            return response()->json(['message' => 'All failed jobs requeued for retry.']);
        }
        return response()->json(['message' => 'Failed to retry jobs.'], 500);
    }

    public function flushFailed(): JsonResponse
    {
        DB::table('failed_jobs')->delete();
        return response()->json(['message' => 'Failed jobs table flushed.']);
    }

    public function systemInfo(): JsonResponse
    {
        $queueConnection = config('queue.default');
        $dbConnection = config('database.default');
        $redisReady = false;
        try {
            $redisReady = app('redis')->command('ping') === 'PONG';
        } catch (\Exception $e) {
            $redisReady = false;
        }

        return response()->json(['data' => [
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'environment' => app()->environment(),
            'queue_connection' => $queueConnection,
            'db_connection' => $dbConnection,
            'redis_connected' => $redisReady,
            'sanctum_token_ttl' => config('sanctum.expiration'),
            'debug_mode' => config('app.debug'),
            'horizon_installed' => class_exists(\Laravel\Horizon\Horizon::class),
        ]]);
    }
}
