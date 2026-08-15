<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use App\Services\MainApiClient;
use App\Services\AdsApiClient;
use App\Services\MarketingApiClient;
use Illuminate\Http\Request;

class HealthController extends Controller
{
    public function __construct(
        private readonly MainApiClient      $mainApi,
        private readonly AdsApiClient       $adsApi,
        private readonly MarketingApiClient $marketingApi,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $checks = [
            'main_backend'       => $this->ping(fn () => $this->mainApi->get('health')),
            'ads_backend'        => $this->ping(fn () => $this->adsApi->get('health')),
            'marketing_backend'  => $this->ping(fn () => $this->marketingApi->get('health')),
        ];

        $allHealthy = !in_array('degraded', $checks, true);

        return response()->json([
            'data' => [
                'status'     => $allHealthy ? 'ok' : 'degraded',
                'version'    => 'v1',
                'services'   => $checks,
                'request_id' => $request->header('X-Request-ID'),
                'checked_at' => now()->toIso8601String(),
            ],
        ], $allHealthy ? 200 : 207);
    }

    private function ping(callable $fn): string
    {
        try {
            $fn();
            return 'ok';
        } catch (\Throwable) {
            return 'degraded';
        }
    }
}
