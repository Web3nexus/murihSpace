<?php

namespace Tests\Feature\Payment;

use App\Enums\CapabilityStatus;
use App\Enums\ProviderHealthStatus;
use App\Models\PaymentProvider;
use App\Models\ProviderCapability;
use App\Models\ProviderRoute;
use App\Services\Payment\Providers\AirwallexProvider;
use App\Services\Payment\Providers\FlutterwaveProvider;
use App\Services\Payment\Providers\PaddleProvider;
use App\Services\Payment\Providers\PaystackProvider;
use App\Services\Payment\Router\CapabilityEngine;
use App\Services\Payment\Router\ProviderRouter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class PaddleRoutingTest extends TestCase
{
    use RefreshDatabase;

    private function provider(string $code, bool $enabled = true, string $health = 'healthy'): PaymentProvider
    {
        return PaymentProvider::create([
            'code' => $code,
            'name' => ucfirst($code),
            'is_enabled' => $enabled,
            'health_status' => ProviderHealthStatus::from($health),
        ]);
    }

    private function capability(PaymentProvider $p, string $capability, string $currency, string $country = '*'): void
    {
        ProviderCapability::create([
            'payment_provider_id' => $p->id,
            'capability' => $capability,
            'country_code' => $country,
            'currency' => $currency,
            'status' => CapabilityStatus::Confirmed,
        ]);
    }

    private function availableMock(string $code): mixed
    {
        $mock = match ($code) {
            'paddle' => Mockery::mock(PaddleProvider::class),
            'airwallex' => Mockery::mock(AirwallexProvider::class),
            'paystack' => Mockery::mock(PaystackProvider::class),
            default => Mockery::mock(FlutterwaveProvider::class),
        };
        $mock->shouldReceive('providerCode')->andReturn($code);
        $mock->shouldReceive('isAvailable')->andReturn(true);

        return $mock;
    }

    private function router(?PaddleProvider $paddle, ?AirwallexProvider $airwallex, ?PaystackProvider $paystack): ProviderRouter
    {
        return new ProviderRouter(
            new CapabilityEngine(),
            $airwallex,
            $paystack,
            Mockery::mock(FlutterwaveProvider::class),
            $paddle
        );
    }

    public function test_coin_pack_business_route_resolves_to_paddle_over_generic_airwallex(): void
    {
        $airwallex = $this->provider('airwallex');
        $this->capability($airwallex, 'card', 'USD');

        $paddle = $this->provider('paddle');
        $this->capability($paddle, 'card', 'USD');

        // Generic commerce route -> Airwallex
        ProviderRoute::create([
            'name' => 'International USD Cards',
            'transaction_type' => 'payment',
            'country_code' => '*',
            'currency' => 'USD',
            'payment_method' => 'card',
            'primary_provider_id' => $airwallex->id,
            'fallback_provider_id' => null,
            'priority' => 10,
            'is_active' => true,
        ]);

        // Business coin-pack route -> Paddle
        ProviderRoute::create([
            'name' => 'Coin Packs via Paddle',
            'transaction_type' => 'coin_pack',
            'country_code' => '*',
            'currency' => 'USD',
            'payment_method' => 'card',
            'primary_provider_id' => $paddle->id,
            'fallback_provider_id' => null,
            'priority' => 10,
            'is_active' => true,
        ]);

        $router = $this->router(
            $this->availableMock('paddle'),
            $this->availableMock('airwallex'),
            null
        );

        $coinProvider = $router->resolve('payment', 'USD', null, 'card', 2500, 'coin_pack');
        $this->assertSame('paddle', $coinProvider->providerCode());

        // Generic commerce still resolves to Airwallex (unchanged behaviour)
        $commerceProvider = $router->resolve('payment', 'USD', null, 'card', 2500, 'commerce');
        $this->assertSame('airwallex', $commerceProvider->providerCode());
    }

    public function test_business_route_does_not_leak_to_other_gateways_when_paddle_unhealthy(): void
    {
        $airwallex = $this->provider('airwallex');
        $this->capability($airwallex, 'card', 'USD');

        $paddle = $this->provider('paddle', true, ProviderHealthStatus::Down->value);
        $this->capability($paddle, 'card', 'USD');

        ProviderRoute::create([
            'name' => 'Coin Packs via Paddle',
            'transaction_type' => 'coin_pack',
            'country_code' => '*',
            'currency' => 'USD',
            'payment_method' => 'card',
            'primary_provider_id' => $paddle->id,
            'fallback_provider_id' => null,
            'priority' => 10,
            'is_active' => true,
        ]);

        $router = $this->router(
            $this->availableMock('paddle'),
            $this->availableMock('airwallex'),
            null
        );

        $this->expectException(\App\Services\Payment\Exceptions\RoutingException::class);

        try {
            $router->resolve('payment', 'USD', null, 'card', 2500, 'coin_pack');
        } catch (\App\Services\Payment\Exceptions\RoutingException $e) {
            throw $e;
        }
    }

    public function test_no_business_route_falls_back_to_generic_payment_routing(): void
    {
        $paystack = $this->provider('paystack');
        $this->capability($paystack, 'card', 'NGN', 'NG');

        ProviderRoute::create([
            'name' => 'Nigeria NGN Cards',
            'transaction_type' => 'payment',
            'country_code' => 'NG',
            'currency' => 'NGN',
            'payment_method' => 'card',
            'primary_provider_id' => $paystack->id,
            'fallback_provider_id' => null,
            'priority' => 10,
            'is_active' => true,
        ]);

        // No coin_pack business route seeded at all.
        $router = new ProviderRouter(
            new CapabilityEngine(),
            null,
            $this->availableMock('paystack'),
            Mockery::mock(FlutterwaveProvider::class)
        );

        // Business type requested but no business route -> generic route wins.
        $resolved = $router->resolve('payment', 'NGN', 'NG', 'card', 5000, 'wallet_topup');
        $this->assertSame('paystack', $resolved->providerCode());
    }
}