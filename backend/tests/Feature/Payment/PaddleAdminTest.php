<?php

namespace Tests\Feature\Payment;

use App\Enums\ProviderHealthStatus;
use App\Models\AdminSetting;
use App\Models\PaymentProvider;
use App\Models\User;
use App\Services\Tax\TaxCalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaddleAdminTest extends TestCase
{
    use RefreshDatabase;

    private User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->adminUser = User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'super_admin',
        ]);
    }

    public function test_admin_can_store_paddle_credentials_and_handles_tax_flag(): void
    {
        $res = $this->actingAs($this->adminUser)->postJson('/api/v1/securegate/payment-providers', [
            'code' => 'paddle',
            'name' => 'Paddle (Merchant of Record)',
            'is_enabled' => true,
            'environment' => 'sandbox',
            'client_token' => 'client_abc123',
            'vendor_id' => '7788',
            'api_key' => 'pdl_test_supersecret',
            'webhook_public_key' => '5c2a...publickey',
            'handles_tax' => true,
        ]);

        $res->assertCreated();

        $provider = PaymentProvider::where('code', 'paddle')->firstOrFail();
        $this->assertTrue((bool) $provider->config['handles_tax']);
        $this->assertSame('client_abc123', $provider->config['client_token']);
        $this->assertSame('7788', $provider->config['vendor_id']);

        // Raw secret keys never leak back in the list response
        $list = $this->actingAs($this->adminUser)->getJson('/api/v1/securegate/payment-providers');
        $this->assertStringNotContainsString('pdl_test_supersecret', $list->getContent());
    }

    public function test_admin_can_toggle_handles_tax_and_update_route_to_business_type(): void
    {
        $provider = PaymentProvider::create([
            'code' => 'paddle',
            'name' => 'Paddle',
            'is_enabled' => true,
            'environment' => 'sandbox',
            'health_status' => ProviderHealthStatus::Healthy,
            'config' => ['handles_tax' => true],
        ]);

        $res = $this->actingAs($this->adminUser)->putJson('/api/v1/securegate/payment-providers/paddle', [
            'handles_tax' => false,
            'api_key' => 'pdl_test_newkey123',
        ]);

        $res->assertOk();
        $provider->refresh();
        $this->assertFalse((bool) $provider->config['handles_tax']);
        $this->assertSame('pdl_test_newkey123', $provider->config['api_key']);

        // Business transaction types accepted on routing rules
        $route = $this->actingAs($this->adminUser)->postJson('/api/v1/securegate/payment-routes', [
            'name' => 'Coin Packs via Paddle',
            'transaction_type' => 'coin_pack',
            'country_code' => '*',
            'currency' => 'USD',
            'payment_method' => 'card',
            'primary_provider_id' => $provider->id,
            'priority' => 10,
            'is_active' => true,
        ]);

        $route->assertCreated();
        $route->assertJsonPath('data.transaction_type', 'coin_pack');
    }

    public function test_global_vat_toggle_controls_checkout_tax_computation(): void
    {
        AdminSetting::set('charge_vat', true);
        $taxService = app(TaxCalculationService::class);

        $withVat = $taxService->resolveCheckoutTax(10000, 'GB');

        // VAT off -> exempt, zero tax
        AdminSetting::set('charge_vat', false);
        $withoutVat = $taxService->resolveCheckoutTax(10000, 'GB');

        $this->assertSame(0, (int) $withVat['tax_amount_cents']);
        $this->assertNotSame('vat_disabled', $withVat['tax_type']);
        $this->assertSame('vat_disabled', $withoutVat['tax_type']);
        $this->assertSame(0, (int) $withoutVat['tax_amount_cents']);

        // Explicit override beats the global toggle
        $forcedOff = $taxService->resolveCheckoutTax(10000, 'GB', null, 'commerce', false);
        $this->assertSame('vat_disabled', $forcedOff['tax_type']);
    }

    public function test_admin_settings_route_exposes_and_persists_charge_vat(): void
    {
        AdminSetting::set('charge_vat', true);

        $show = $this->actingAs($this->adminUser)->getJson('/api/v1/securegate/settings');
        $show->assertOk()->assertJsonPath('data.data.charge_vat', true);

        $update = $this->actingAs($this->adminUser)->putJson('/api/v1/securegate/settings', [
            'charge_vat' => false,
        ]);
        $update->assertOk()->assertJsonPath('data.data.charge_vat', false);

        $this->assertFalse((bool) AdminSetting::get('charge_vat', true));
    }
}