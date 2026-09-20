<?php

namespace App\Services\Payment\Router;

use App\Enums\ProviderHealthStatus;
use App\Models\PaymentProvider;
use App\Models\ProviderRoute;
use App\Services\Payment\Contracts\PaymentProviderInterface;
use App\Services\Payment\Exceptions\RoutingException;
use App\Services\Payment\Providers\AirwallexProvider;
use App\Services\Payment\Providers\FlutterwaveProvider;
use App\Services\Payment\Providers\PaddleProvider;
use App\Services\Payment\Providers\PaystackProvider;
use Illuminate\Support\Facades\Log;

class ProviderRouter
{
    protected array $providerInstances = [];

    public function __construct(
        protected CapabilityEngine $capabilityEngine,
        ?AirwallexProvider $airwallex = null,
        ?PaystackProvider $paystack = null,
        ?FlutterwaveProvider $flutterwave = null,
        ?PaddleProvider $paddle = null
    ) {
        $this->providerInstances['airwallex'] = $airwallex ?? app(AirwallexProvider::class);
        $this->providerInstances['paystack'] = $paystack ?? app(PaystackProvider::class);
        $this->providerInstances['flutterwave'] = $flutterwave ?? app(FlutterwaveProvider::class);
        $this->providerInstances['paddle'] = $paddle ?? app(PaddleProvider::class);
    }

    /**
     * Register an additional provider instance (e.g. future MurihPayProvider).
     */
    public function registerProvider(string $code, PaymentProviderInterface $instance): void
    {
        $this->providerInstances[strtolower($code)] = $instance;
    }

    /**
     * Get a specific provider by code.
     */
    public function getProvider(string $code): PaymentProviderInterface
    {
        $code = strtolower($code);
        if (! isset($this->providerInstances[$code])) {
            throw new RoutingException("Payment provider '{$code}' is not registered.");
        }

        return $this->providerInstances[$code];
    }

    /**
     * Resolves the best provider for a given transaction.
     *
     * @param  string  $transactionType  payment, payout, refund
     * @param  string  $currency  3-letter currency code (e.g. NGN, USD)
     * @param  string|null  $country  2-letter country code (e.g. NG, US)
     * @param  string  $paymentMethod  card, bank_transfer, mobile_money
     * @param  int|null  $amount  Minor units
     * @param  string|null  $businessType  business stream that overrides generic routing
     *                                     (e.g. coin_pack, gift, wallet_topup, order). Routes
     *                                     matching this type win over generic 'payment' routes.
     */
    public function resolve(
        string $transactionType = 'payment',
        string $currency = 'NGN',
        ?string $country = null,
        string $paymentMethod = 'card',
        ?int $amount = null,
        ?string $businessType = null
    ): PaymentProviderInterface {
        $currency = strtoupper($currency);
        $country = $country ? strtoupper($country) : null;

        // 1. Business-specific routing (coins/gifts/top-ups -> Paddle).
        //    When a business route exists it is authoritative: we never leak these
        //    streams onto the generic commerce gateways (Paystack/Flutterwave/Airwallex).
        if ($businessType && $businessType !== 'payment') {
            $businessRoutes = $this->fetchRoutes($businessType, $currency, $country, $paymentMethod);

            if ($businessRoutes->isNotEmpty()) {
                $resolved = $this->tryRoutes($businessRoutes, $paymentMethod, $currency, $country, $amount);
                if ($resolved !== null) {
                    return $resolved;
                }

                throw new RoutingException(
                    "No capable and healthy payment provider found for business type: {$businessType}, currency: {$currency}, country: {$country}, method: {$paymentMethod}.",
                    [
                        'transaction_type' => $transactionType,
                        'business_type' => $businessType,
                        'currency' => $currency,
                        'country' => $country,
                        'payment_method' => $paymentMethod,
                        'amount' => $amount,
                    ]
                );
            }
        }

        // 2. Generic routing (commerce stays on its existing gateways)
        $routes = $this->fetchRoutes('payment', $currency, $country, $paymentMethod);

        $resolved = $this->tryRoutes($routes, $paymentMethod, $currency, $country, $amount);
        if ($resolved !== null) {
            return $resolved;
        }

        // 3. Dynamic Fallback: Inspect all enabled providers directly
        $enabledProviders = PaymentProvider::where('is_enabled', true)
            ->where('health_status', '!=', ProviderHealthStatus::Down)
            ->orderBy('priority', 'asc')
            ->get();

        foreach ($enabledProviders as $providerModel) {
            if ($this->isProviderUsable($providerModel, $paymentMethod, $currency, $country, $amount)) {
                return $this->getProvider($providerModel->code);
            }
        }

        throw new RoutingException(
            "No capable and healthy payment provider found for type: {$transactionType}, currency: {$currency}, country: {$country}, method: {$paymentMethod}.",
            [
                'transaction_type' => $transactionType,
                'currency' => $currency,
                'country' => $country,
                'payment_method' => $paymentMethod,
                'amount' => $amount,
            ]
        );
    }

    /**
     * Try each route in priority order; returns the resolved provider or null.
     */
    protected function tryRoutes($routes, string $paymentMethod, string $currency, ?string $country, ?int $amount): ?PaymentProviderInterface
    {
        foreach ($routes as $route) {
            // Check Primary Provider
            if ($route->primaryProvider && $this->isProviderUsable($route->primaryProvider, $paymentMethod, $currency, $country, $amount)) {
                return $this->getProvider($route->primaryProvider->code);
            }

            // If Primary is down/unhealthy, attempt Fallback Provider
            if ($route->fallbackProvider && $this->isProviderUsable($route->fallbackProvider, $paymentMethod, $currency, $country, $amount)) {
                Log::info("Primary provider for route '{$route->name}' unavailable; routed to fallback: {$route->fallbackProvider->code}");

                return $this->getProvider($route->fallbackProvider->code);
            }
        }

        return null;
    }

    /**
     * Query active provider routes for a single transaction_type group, ordered by priority.
     */
    protected function fetchRoutes(string $type, string $currency, ?string $country, string $paymentMethod): \Illuminate\Support\Collection
    {
        return ProviderRoute::where('is_active', true)
            ->where('transaction_type', $type)
            ->where(function ($q) use ($currency) {
                $q->where('currency', $currency)->orWhere('currency', '*');
            })
            ->where(function ($q) use ($country) {
                if ($country) {
                    $q->where('country_code', $country)->orWhere('country_code', '*');
                } else {
                    $q->where('country_code', '*');
                }
            })
            ->where(function ($q) use ($paymentMethod) {
                $q->where('payment_method', $paymentMethod)->orWhere('payment_method', '*');
            })
            ->with(['primaryProvider', 'fallbackProvider'])
            ->orderBy('priority', 'asc')
            ->get();
    }

    protected function isProviderUsable(
        PaymentProvider $providerModel,
        string $capability,
        string $currency,
        ?string $country,
        ?int $amount
    ): bool {
        if (! $providerModel->is_enabled || $providerModel->health_status === ProviderHealthStatus::Down) {
            return false;
        }

        $code = strtolower($providerModel->code);
        if (! isset($this->providerInstances[$code])) {
            return false;
        }

        $instance = $this->providerInstances[$code];
        if (! $instance->isAvailable()) {
            return false;
        }

        return $this->capabilityEngine->canHandle($providerModel, $instance, $capability, $currency, $country, $amount);
    }
}
