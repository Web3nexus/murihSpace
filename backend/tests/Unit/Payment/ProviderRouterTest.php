<?php

namespace Tests\Unit\Payment;

use App\Enums\CapabilityStatus;
use App\Enums\ProviderHealthStatus;
use App\Models\PaymentProvider;
use App\Models\ProviderCapability;
use App\Models\ProviderRoute;
use App\Services\Payment\Contracts\PaymentProviderInterface;
use App\Services\Payment\Providers\AirwallexProvider;
use App\Services\Payment\Providers\FlutterwaveProvider;
use App\Services\Payment\Providers\PaystackProvider;
use App\Services\Payment\Router\CapabilityEngine;
use App\Services\Payment\Router\ProviderRouter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class ProviderRouterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['payments.providers.airwallex.enabled' => true]);
        config(['payments.providers.paystack.enabled' => true]);
        config(['payments.providers.flutterwave.enabled' => true]);
    }

    public function test_resolves_primary_provider_based_on_configured_route(): void
    {
        $paystack = PaymentProvider::create([
            'code' => 'paystack',
            'name' => 'Paystack',
            'is_enabled' => true,
            'health_status' => ProviderHealthStatus::Healthy,
        ]);

        $flutterwave = PaymentProvider::create([
            'code' => 'flutterwave',
            'name' => 'Flutterwave',
            'is_enabled' => true,
            'health_status' => ProviderHealthStatus::Healthy,
        ]);

        ProviderCapability::create([
            'payment_provider_id' => $paystack->id,
            'capability' => 'card',
            'country_code' => 'NG',
            'currency' => 'NGN',
            'status' => CapabilityStatus::Confirmed,
        ]);

        ProviderRoute::create([
            'name' => 'Nigeria NGN Cards',
            'transaction_type' => 'payment',
            'country_code' => 'NG',
            'currency' => 'NGN',
            'payment_method' => 'card',
            'primary_provider_id' => $paystack->id,
            'fallback_provider_id' => $flutterwave->id,
            'priority' => 10,
            'is_active' => true,
        ]);

        $paystackMock = Mockery::mock(PaystackProvider::class, PaymentProviderInterface::class);
        $paystackMock->shouldReceive('providerCode')->andReturn('paystack');
        $paystackMock->shouldReceive('isAvailable')->andReturn(true);

        $flutterwaveMock = Mockery::mock(FlutterwaveProvider::class, PaymentProviderInterface::class);
        $flutterwaveMock->shouldReceive('providerCode')->andReturn('flutterwave');
        $flutterwaveMock->shouldReceive('isAvailable')->andReturn(true);

        $router = new ProviderRouter(
            new CapabilityEngine(),
            null,
            $paystackMock,
            $flutterwaveMock
        );

        $resolved = $router->resolve('payment', 'NGN', 'NG', 'card');
        $this->assertEquals('paystack', $resolved->providerCode());
    }

    public function test_switches_to_fallback_when_primary_provider_is_down(): void
    {
        $paystack = PaymentProvider::create([
            'code' => 'paystack',
            'name' => 'Paystack',
            'is_enabled' => true,
            'health_status' => ProviderHealthStatus::Down, // Primary is DOWN
        ]);

        $flutterwave = PaymentProvider::create([
            'code' => 'flutterwave',
            'name' => 'Flutterwave',
            'is_enabled' => true,
            'health_status' => ProviderHealthStatus::Healthy, // Fallback is HEALTHY
        ]);

        ProviderCapability::create([
            'payment_provider_id' => $flutterwave->id,
            'capability' => 'card',
            'country_code' => 'NG',
            'currency' => 'NGN',
            'status' => CapabilityStatus::Confirmed,
        ]);

        ProviderRoute::create([
            'name' => 'Nigeria NGN Cards',
            'transaction_type' => 'payment',
            'country_code' => 'NG',
            'currency' => 'NGN',
            'payment_method' => 'card',
            'primary_provider_id' => $paystack->id,
            'fallback_provider_id' => $flutterwave->id,
            'priority' => 10,
            'is_active' => true,
        ]);

        $paystackMock = Mockery::mock(PaystackProvider::class, PaymentProviderInterface::class);
        $paystackMock->shouldReceive('providerCode')->andReturn('paystack');
        $paystackMock->shouldReceive('isAvailable')->andReturn(false);

        $flutterwaveMock = Mockery::mock(FlutterwaveProvider::class, PaymentProviderInterface::class);
        $flutterwaveMock->shouldReceive('providerCode')->andReturn('flutterwave');
        $flutterwaveMock->shouldReceive('isAvailable')->andReturn(true);

        $router = new ProviderRouter(
            new CapabilityEngine(),
            null,
            $paystackMock,
            $flutterwaveMock
        );

        // Expect automatic fallback to Flutterwave
        $resolved = $router->resolve('payment', 'NGN', 'NG', 'card');
        $this->assertEquals('flutterwave', $resolved->providerCode());
    }

    public function test_future_murihpay_can_be_registered_dynamically(): void
    {
        $murihPayMock = Mockery::mock(PaymentProviderInterface::class);
        $murihPayMock->shouldReceive('providerCode')->andReturn('murihpay');
        $murihPayMock->shouldReceive('isAvailable')->andReturn(true);

        $router = new ProviderRouter(new CapabilityEngine());
        $router->registerProvider('murihpay', $murihPayMock);

        $this->assertSame($murihPayMock, $router->getProvider('murihpay'));
    }
}

