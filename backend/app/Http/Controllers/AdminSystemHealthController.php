<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

class AdminSystemHealthController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $dbConnected = false;
        $cacheConnected = false;
        $queueResponsive = false;

        try { DB::connection()->getPdo(); $dbConnected = true; } catch (\Exception $e) {}
        try { $cacheConnected = Cache::set('health-check', true, 10); } catch (\Exception $e) {}
        try { $queueResponsive = Queue::size() >= 0; } catch (\Exception $e) {}

        return response()->json([
            'data' => [
                'status' => $dbConnected && $cacheConnected ? 'healthy' : 'degraded',
                'uptime' => function_exists('exec') ? @exec('uptime') : null,
                'last_check' => now()->toIso8601String(),
                'services' => [
                    'database' => $dbConnected ? 'connected' : 'disconnected',
                    'cache' => $cacheConnected ? 'connected' : 'disconnected',
                    'queue' => $queueResponsive ? 'responsive' : 'unresponsive',
                ],
            ],
        ]);
    }
}
