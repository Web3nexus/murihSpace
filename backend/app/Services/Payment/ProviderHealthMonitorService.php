<?php

namespace App\Services\Payment;

use App\Enums\ProviderHealthStatus;
use App\Models\PaymentProvider;
use App\Models\ProviderApiLog;
use App\Services\Payment\Router\ProviderRouter;
use Exception;
use Illuminate\Support\Facades\Log;

class ProviderHealthMonitorService
{
    public function __construct(
        protected ProviderRouter $router
    ) {}

    /**
     * Checks the health of all registered providers and updates their status in DB.
     *
     * @return array<string, array{status: string, latency_ms: int, message: string}>
     */
    public function checkAll(): array
    {
        $providers = PaymentProvider::all();
        $results = [];

        foreach ($providers as $providerModel) {
            $results[$providerModel->code] = $this->checkProvider($providerModel);
        }

        return $results;
    }

    /**
     * Checks the live connectivity and recent failure rate of an individual provider.
     */
    public function checkProvider(PaymentProvider $providerModel): array
    {
        try {
            $instance = $this->router->getProvider($providerModel->code);
            $ping = $instance->testConnection();

            // Check recent failure rates from provider_api_logs (last 15 minutes)
            $recentLogs = ProviderApiLog::where('provider', $providerModel->code)
                ->where('created_at', '>=', now()->subMinutes(15))
                ->get();

            $totalCalls = $recentLogs->count();
            $failedCalls = $recentLogs->where('is_success', false)->count();
            $errorRate = $totalCalls > 0 ? ($failedCalls / $totalCalls) : 0;

            $status = ProviderHealthStatus::Healthy;
            if (! $ping['healthy']) {
                $status = ProviderHealthStatus::Down;
            } elseif ($errorRate >= 0.20 || $ping['latency_ms'] > 4000) {
                $status = ProviderHealthStatus::Degraded;
            }

            $providerModel->update([
                'health_status' => $status,
                'last_health_check_at' => now(),
                'last_successful_request_at' => $ping['healthy'] ? now() : $providerModel->last_successful_request_at,
                'last_failed_request_at' => ! $ping['healthy'] ? now() : $providerModel->last_failed_request_at,
            ]);

            return [
                'status' => $status->value,
                'latency_ms' => $ping['latency_ms'],
                'message' => $ping['message'],
                'error_rate_pct' => round($errorRate * 100, 1),
            ];
        } catch (Exception $e) {
            Log::error("Provider health check exception for {$providerModel->code}: {$e->getMessage()}");
            $providerModel->update([
                'health_status' => ProviderHealthStatus::Down,
                'last_health_check_at' => now(),
                'last_failed_request_at' => now(),
            ]);

            return [
                'status' => ProviderHealthStatus::Down->value,
                'latency_ms' => 0,
                'message' => $e->getMessage(),
                'error_rate_pct' => 100,
            ];
        }
    }
}
