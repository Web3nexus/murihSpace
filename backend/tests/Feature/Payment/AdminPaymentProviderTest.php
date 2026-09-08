<?php

namespace Tests\Feature\Payment;

use App\Enums\CapabilityStatus;
use App\Enums\ProviderHealthStatus;
use App\Models\PaymentProvider;
use App\Models\ProviderCapability;
use App\Models\ProviderRoute;
use App\Models\User;
use App\Services\Payment\Contracts\PaymentProviderInterface;
use App\Services\Payment\Providers\FlutterwaveProvider;
use App\Services\Payment\Providers\PaystackProvider;
use App\Services\Payment\Router\ProviderRouter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class AdminPaymentProviderTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::factory()->create([
            'role'       => 'admin',
            'admin_role' => 'super_admin',
        ]);
    }

    public function test_admin_lists_providers_without_exposing_secret_keys(): void
    {
        PaymentProvider::create([
            'code' => 'airwallex',
            'name' => 'Airwallex',
            'is_enabled' => true,
            'environment' => 'sandbox',
            'priority' => 10,
            'health_status' => ProviderHealthStatus::Healthy,
        ]);

        $res = $this->actingAs($this->adminUser)->getJson('/api/v1/securegate/payment-providers');

        $res->assertStatus(200);
        $res->assertJsonStructure([
            'success',
            'data' => [
                '*' => [
                    'id',
                    'code',
                    'name',
                    'is_enabled',
                    'environment',
                    'priority',
                    'health_status',
                    'credential_status',
                ],
            ],
        ]);

        // Assert secret keys are nowhere in the output
        $content = $res->getContent();
        $this->assertStringNotContainsString('api_key', $content);
        $this->assertStringNotContainsString('secret_key', $content);
        $this->assertStringNotContainsString('webhook_secret', $content);
    }

    public function test_admin_can_update_provider_and_records_audit_log(): void
    {
        $provider = PaymentProvider::create([
            'code' => 'paystack',
            'name' => 'Paystack',
            'is_enabled' => true,
            'environment' => 'test',
            'priority' => 10,
            'health_status' => ProviderHealthStatus::Healthy,
        ]);

        $res = $this->actingAs($this->adminUser)->putJson("/api/v1/securegate/payment-providers/{$provider->code}", [
            'is_enabled' => false,
            'environment' => 'live',
            'priority' => 50,
            'reason' => 'Temporarily disabling Paystack for scheduled gateway maintenance.',
        ]);

        $res->assertStatus(200);

        $this->assertDatabaseHas('payment_providers', [
            'code' => 'paystack',
            'is_enabled' => false,
            'environment' => 'live',
            'priority' => 50,
        ]);

        $this->assertDatabaseHas('financial_audit_logs', [
            'admin_id' => $this->adminUser->id,
            'action' => 'provider_update',
            'resource_id' => 'paystack',
            'reason' => 'Temporarily disabling Paystack for scheduled gateway maintenance.',
        ]);
    }

    public function test_provider_switching_verification_disabling_paystack_routes_to_flutterwave(): void
    {
        // Setup Paystack and Flutterwave
        $paystack = PaymentProvider::create([
            'code' => 'paystack',
            'name' => 'Paystack',
            'is_enabled' => true,
            'priority' => 10,
            'health_status' => ProviderHealthStatus::Healthy,
        ]);

        $flutterwave = PaymentProvider::create([
            'code' => 'flutterwave',
            'name' => 'Flutterwave',
            'is_enabled' => true,
            'priority' => 20,
            'health_status' => ProviderHealthStatus::Healthy,
        ]);

        ProviderCapability::create([
            'payment_provider_id' => $paystack->id,
            'capability' => 'card',
            'country_code' => 'NG',
            'currency' => 'NGN',
            'status' => CapabilityStatus::Confirmed,
        ]);

        ProviderCapability::create([
            'payment_provider_id' => $flutterwave->id,
            'capability' => 'card',
            'country_code' => 'NG',
            'currency' => 'NGN',
            'status' => CapabilityStatus::Confirmed,
        ]);

        ProviderRoute::create([
            'name' => 'NG Cards Route',
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
        $paystackMock->shouldReceive('providerName')->andReturn('Paystack');
        $paystackMock->shouldReceive('isAvailable')->andReturn(true);

        $flutterwaveMock = Mockery::mock(FlutterwaveProvider::class, PaymentProviderInterface::class);
        $flutterwaveMock->shouldReceive('providerCode')->andReturn('flutterwave');
        $flutterwaveMock->shouldReceive('providerName')->andReturn('Flutterwave');
        $flutterwaveMock->shouldReceive('isAvailable')->andReturn(true);

        $router = app(ProviderRouter::class);
        $router->registerProvider('paystack', $paystackMock);
        $router->registerProvider('flutterwave', $flutterwaveMock);

        // Initially routes to Paystack
        $sim1 = $this->actingAs($this->adminUser)->postJson('/api/v1/securegate/payment-routes/simulate', [
            'transaction_type' => 'payment',
            'country' => 'NG',
            'currency' => 'NGN',
            'payment_method' => 'card',
        ]);
        $sim1->assertStatus(200);
        $sim1->assertJsonPath('data.resolved_provider', 'paystack');

        // Admin disables Paystack tomorrow
        $this->actingAs($this->adminUser)->putJson('/api/v1/securegate/payment-providers/paystack', [
            'is_enabled' => false,
            'reason' => 'Disabling Paystack per Section 32 Provider Switching Test',
        ]);

        // Simulating the exact same transaction now resolves to Flutterwave without modifying any code!
        $sim2 = $this->actingAs($this->adminUser)->postJson('/api/v1/securegate/payment-routes/simulate', [
            'transaction_type' => 'payment',
            'country' => 'NG',
            'currency' => 'NGN',
            'payment_method' => 'card',
        ]);
        $sim2->assertStatus(200);
        $sim2->assertJsonPath('data.resolved_provider', 'flutterwave');
    }
}
