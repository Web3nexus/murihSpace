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
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class AdminPaymentProviderTest extends TestCase
{
    use ActsAsSession;

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

        $res = $this->actingAsSession($this->adminUser)->getJson('/api/v1/securegate/payment-providers');

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

        $res = $this->actingAsSession($this->adminUser)->putJson("/api/v1/securegate/payment-providers/{$provider->code}", [
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
        $sim1 = $this->actingAsSession($this->adminUser)->postJson('/api/v1/securegate/payment-routes/simulate', [
            'transaction_type' => 'payment',
            'country' => 'NG',
            'currency' => 'NGN',
            'payment_method' => 'card',
        ]);
        $sim1->assertStatus(200);
        $sim1->assertJsonPath('data.resolved_provider', 'paystack');

        // Admin disables Paystack tomorrow
        $this->actingAsSession($this->adminUser)->putJson('/api/v1/securegate/payment-providers/paystack', [
            'is_enabled' => false,
            'reason' => 'Disabling Paystack per Section 32 Provider Switching Test',
        ]);

        // Simulating the exact same transaction now resolves to Flutterwave without modifying any code!
        $sim2 = $this->actingAsSession($this->adminUser)->postJson('/api/v1/securegate/payment-routes/simulate', [
            'transaction_type' => 'payment',
            'country' => 'NG',
            'currency' => 'NGN',
            'payment_method' => 'card',
        ]);
        $sim2->assertStatus(200);
        $sim2->assertJsonPath('data.resolved_provider', 'flutterwave');
    }

    public function test_admin_can_store_flutterwave_encryption_key_without_exposing_it(): void
    {
        $provider = PaymentProvider::create([
            'code' => 'flutterwave',
            'name' => 'Flutterwave',
            'is_enabled' => true,
            'environment' => 'sandbox',
            'priority' => 20,
            'health_status' => ProviderHealthStatus::Healthy,
        ]);

        $res = $this->actingAsSession($this->adminUser)->putJson("/api/v1/securegate/payment-providers/{$provider->code}", [
            'public_key' => 'FLWPUBK_TEST',
            'secret_key' => 'FLWSECK_TEST',
            'encryption_key' => 'FLWSECK_TEST_ENCRYPTION',
            'reason' => 'Provisioning Flutterwave inline checkout credentials.',
        ]);

        $res->assertStatus(200);

        $provider->refresh();
        $this->assertSame('FLWSECK_TEST_ENCRYPTION', $provider->config['encryption_key']);

        // The resolver must surface it so inline checkout can use it.
        $this->assertSame(
            'FLWSECK_TEST_ENCRYPTION',
            \App\Services\Payment\Support\ProviderConfigResolver::resolve('flutterwave')['encryption_key']
        );

        // The list payload reports the status flag but never the key itself.
        $list = $this->actingAsSession($this->adminUser)->getJson('/api/v1/securegate/payment-providers');
        $list->assertStatus(200);
        $list->assertJsonFragment(['code' => 'flutterwave', 'has_encryption_key' => true]);
        $this->assertStringNotContainsString('FLWSECK_TEST_ENCRYPTION', $list->getContent());
    }

    public function test_admin_can_update_routing_rule_and_records_audit_log(): void
    {
        $primary = PaymentProvider::create([
            'code' => 'paystack',
            'name' => 'Paystack',
            'is_enabled' => true,
            'priority' => 10,
            'health_status' => ProviderHealthStatus::Healthy,
        ]);

        $fallback = PaymentProvider::create([
            'code' => 'flutterwave',
            'name' => 'Flutterwave',
            'is_enabled' => true,
            'priority' => 20,
            'health_status' => ProviderHealthStatus::Healthy,
        ]);

        $route = ProviderRoute::create([
            'name' => 'Original Route',
            'transaction_type' => 'payment',
            'country_code' => 'NG',
            'currency' => 'NGN',
            'payment_method' => 'card',
            'primary_provider_id' => $primary->id,
            'fallback_provider_id' => $fallback->id,
            'priority' => 10,
            'is_active' => true,
        ]);

        $res = $this->actingAsSession($this->adminUser)->putJson("/api/v1/securegate/payment-routes/{$route->id}", [
            'name' => 'Updated Route Name',
            'priority' => 5,
            'is_active' => false,
            'reason' => 'Lowering priority and deactivating route during gateway audit',
        ]);

        $res->assertOk();
        $res->assertJsonPath('success', true);
        $res->assertJsonPath('data.name', 'Updated Route Name');
        $res->assertJsonPath('data.priority', 5);
        $res->assertJsonPath('data.is_active', false);

        $route->refresh();
        $this->assertSame('Updated Route Name', $route->name);
        $this->assertSame(5, $route->priority);
        $this->assertFalse((bool) $route->is_active);

        $this->assertDatabaseHas('financial_audit_logs', [
            'admin_id' => $this->adminUser->id,
            'action' => 'route_updated',
            'resource_type' => 'provider_route',
            'resource_id' => (string) $route->id,
            'reason' => 'Lowering priority and deactivating route during gateway audit',
        ]);
    }

    public function test_admin_can_toggle_route_active_status(): void
    {
        $primary = PaymentProvider::create([
            'code' => 'paystack',
            'name' => 'Paystack',
            'is_enabled' => true,
            'priority' => 10,
            'health_status' => ProviderHealthStatus::Healthy,
        ]);

        $route = ProviderRoute::create([
            'name' => 'Toggle Route',
            'transaction_type' => 'payment',
            'country_code' => 'NG',
            'currency' => 'NGN',
            'payment_method' => 'card',
            'primary_provider_id' => $primary->id,
            'priority' => 1,
            'is_active' => true,
        ]);

        $res = $this->actingAsSession($this->adminUser)->patchJson("/api/v1/securegate/payment-routes/{$route->id}", [
            'is_active' => false,
        ]);

        $res->assertOk();
        $this->assertFalse((bool) $route->fresh()->is_active);

        $res2 = $this->actingAsSession($this->adminUser)->patchJson("/api/v1/securegate/payment-routes/{$route->id}", [
            'is_active' => true,
        ]);

        $res2->assertOk();
        $this->assertTrue((bool) $route->fresh()->is_active);
    }

    public function test_non_super_admin_cannot_update_routing_rule(): void
    {
        $primary = PaymentProvider::create([
            'code' => 'paystack',
            'name' => 'Paystack',
            'is_enabled' => true,
            'priority' => 10,
            'health_status' => ProviderHealthStatus::Healthy,
        ]);

        $route = ProviderRoute::create([
            'name' => 'Route',
            'transaction_type' => 'payment',
            'country_code' => 'NG',
            'currency' => 'NGN',
            'payment_method' => 'card',
            'primary_provider_id' => $primary->id,
            'priority' => 1,
            'is_active' => true,
        ]);

        $supportAdmin = User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'support_admin',
        ]);

        $res = $this->actingAsSession($supportAdmin)->putJson("/api/v1/securegate/payment-routes/{$route->id}", [
            'name' => 'Forbidden Name Change',
        ]);

        $res->assertForbidden();
    }
}


