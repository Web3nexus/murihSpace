<?php

namespace App\Http\Controllers;

use App\Models\FinancialAuditLog;
use App\Models\PaymentProvider;
use App\Models\ProviderRoute;
use App\Services\Payment\ProviderHealthMonitorService;
use App\Services\Payment\Router\ProviderRouter;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPaymentProviderController extends Controller
{
    public function __construct(
        protected ProviderRouter $router,
        protected ProviderHealthMonitorService $healthMonitor
    ) {}

    private function authorizeSuperAdmin(Request $request): void
    {
        if (! $request->user() || ! $request->user()->isSuperAdmin()) {
            abort(403, 'Forbidden. Payment infrastructure configuration is restricted to Super Administrators.');
        }
    }

    /**
     * List all providers with health, credential status, and capabilities.
     * Note: Raw secret keys are NEVER returned in the API response.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $providers = PaymentProvider::with('capabilities')->get();

        $data = $providers->map(function ($p) {
            $configKey = "payments.providers.{$p->code}";
            $hasSecret = false;

            if ($p->code === 'airwallex') {
                $hasSecret = ! empty(config("{$configKey}.client_id")) && ! empty(config("{$configKey}.api_key"));
            } elseif ($p->code === 'paystack') {
                $hasSecret = ! empty(config("{$configKey}.secret_key"));
            } elseif ($p->code === 'flutterwave') {
                $hasSecret = ! empty(config("{$configKey}.secret_key"));
            }

            $credentialStatus = $hasSecret ? 'Configured' : 'Not configured';

            return [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'is_enabled' => $p->is_enabled,
                'environment' => $p->environment,
                'priority' => $p->priority,
                'health_status' => $p->health_status->value,
                'credential_status' => $credentialStatus,
                'last_health_check_at' => $p->last_health_check_at?->toISOString(),
                'last_successful_request_at' => $p->last_successful_request_at?->toISOString(),
                'last_failed_request_at' => $p->last_failed_request_at?->toISOString(),
                'capabilities' => $p->capabilities->map(fn ($c) => [
                    'id' => $c->id,
                    'capability' => $c->capability,
                    'country_code' => $c->country_code,
                    'currency' => $c->currency,
                    'status' => $c->status->value,
                    'min_amount' => $c->min_amount,
                    'max_amount' => $c->max_amount,
                ]),
            ];
        });

        return response()->json($data->values()->all());
    }

    /**
     * Update provider settings (toggle active, environment, priority).
     */
    public function update(Request $request, string $code): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        $provider = PaymentProvider::where('code', $code)->firstOrFail();

        $validated = $request->validate([
            'is_enabled' => ['nullable', 'boolean'],
            'environment' => ['nullable', 'string', 'in:sandbox,production,test,live'],
            'priority' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $oldValues = $provider->only(['is_enabled', 'environment', 'priority']);

        if (isset($validated['is_enabled'])) {
            $provider->is_enabled = $validated['is_enabled'];
        }
        if (isset($validated['environment'])) {
            $provider->environment = $validated['environment'];
        }
        if (isset($validated['priority'])) {
            $provider->priority = $validated['priority'];
        }

        $provider->save();

        // Record Financial Audit Log
        FinancialAuditLog::create([
            'admin_id' => $request->user()?->id,
            'action' => 'provider_update',
            'resource_type' => 'payment_provider',
            'resource_id' => $provider->code,
            'old_values' => $oldValues,
            'new_values' => $provider->only(['is_enabled', 'environment', 'priority']),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'reason' => $validated['reason'],
        ]);

        return response()->json(['success' => true, 'message' => 'Provider updated successfully.', 'data' => $provider]);
    }

    /**
     * Test live connectivity for a specific provider.
     */
    public function testConnection(Request $request, string $code): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        $provider = PaymentProvider::where('code', $code)->firstOrFail();
        $result = $this->healthMonitor->checkProvider($provider);

        return response()->json([
            'success' => true,
            'provider' => $code,
            'result' => $result,
        ]);
    }

    /**
     * List all database routing rules.
     */
    public function routes(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        $routes = ProviderRoute::with(['primaryProvider', 'fallbackProvider'])
            ->orderBy('priority', 'asc')
            ->get();

        return response()->json(['success' => true, 'data' => $routes]);
    }

    /**
     * Create or update a provider route.
     */
    public function storeRoute(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'transaction_type' => ['required', 'string', 'in:payment,payout,refund'],
            'country_code' => ['required', 'string', 'max:5'],
            'currency' => ['required', 'string', 'max:5'],
            'payment_method' => ['required', 'string', 'max:40'],
            'primary_provider_id' => ['required', 'integer', 'exists:payment_providers,id'],
            'fallback_provider_id' => ['nullable', 'integer', 'exists:payment_providers,id'],
            'priority' => ['required', 'integer', 'min:1', 'max:1000'],
            'is_active' => ['required', 'boolean'],
            'reason' => ['nullable', 'string'],
        ]);

        $route = ProviderRoute::create($validated);

        FinancialAuditLog::create([
            'admin_id' => $request->user()?->id,
            'action' => 'route_created',
            'resource_type' => 'provider_route',
            'resource_id' => (string) $route->id,
            'new_values' => $route->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'reason' => $validated['reason'] ?? 'Admin created routing rule',
        ]);

        return response()->json(['success' => true, 'data' => $route->load(['primaryProvider', 'fallbackProvider'])], 201);
    }

    /**
     * Simulate provider routing for testing and validation.
     */
    public function simulateRouting(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        $validated = $request->validate([
            'transaction_type' => ['required', 'string', 'in:payment,payout,refund'],
            'country' => ['nullable', 'string', 'size:2'],
            'currency' => ['required', 'string', 'size:3'],
            'payment_method' => ['required', 'string'],
            'amount' => ['nullable', 'integer'],
        ]);

        try {
            $provider = $this->router->resolve(
                transactionType: $validated['transaction_type'],
                currency: $validated['currency'],
                country: $validated['country'] ?? null,
                paymentMethod: $validated['payment_method'],
                amount: $validated['amount'] ?? null
            );

            return response()->json([
                'resolved_provider' => $provider->providerCode(),
                'provider_name' => $provider->providerName(),
                'is_available' => $provider->isAvailable(),
            ]);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }
}
