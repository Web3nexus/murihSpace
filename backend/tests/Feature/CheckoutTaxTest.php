<?php

namespace Tests\Feature;

use App\Models\DigitalProduct;
use App\Models\TaxRate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutTaxTest extends TestCase
{
    use RefreshDatabase;

    private User $buyer;

    private DigitalProduct $product;

    protected function setUp(): void
    {
        parent::setUp();

        $creator = User::factory()->create();

        $this->buyer = User::factory()->create(['email_verified_at' => now()]);

        $this->product = DigitalProduct::create([
            'creator_id' => $creator->id,
            'title' => 'VAT Test Product',
            'slug' => 'vat-test-product',
            'price' => 100.00,
            'currency' => 'USD',
        ]);

        TaxRate::updateOrCreate(
            ['country_code' => 'TST', 'tax_name' => 'Value Added Tax (VAT)'],
            [
                'country_name' => 'Testland',
                'standard_rate_percentage' => 10.00,
                'wht_rate_percentage' => 0.00,
                'stream_rates' => ['commerce' => 10.00],
                'is_active' => true,
            ]
        );
    }

    public function test_estimate_returns_country_vat_breakdown(): void
    {
        $res = $this->actingAs($this->buyer)->postJson('/api/v1/checkout/estimate', [
            'product_id' => $this->product->id,
            'country_code' => 'TST',
        ]);

        $res->assertOk();
        $res->assertJsonPath('data.data.tax', 10);
        $res->assertJsonPath('data.data.tax_rate', 10);
        $res->assertJsonPath('data.data.tax_type', 'vat');
        $res->assertJsonPath('data.data.tax_country_code', 'TST');
        $res->assertJsonPath('data.data.platform_fee', 10);
        $res->assertJsonPath('data.data.total', 120);
    }

    public function test_intent_applies_country_vat_and_records_ledger_on_completion(): void
    {
        $intent = $this->actingAs($this->buyer)->postJson('/api/v1/checkout/intent', [
            'product_id' => $this->product->id,
            'payment_provider' => 'mock',
            'idempotency_key' => 'vat-idem-'.rand(1000, 9999),
            'country_code' => 'TST',
        ]);

        $intent->assertStatus(201);
        $orderId = $intent->json('data.data.order.id');
        $orderNumber = $intent->json('data.data.order.order_number');

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'tax' => 10.00,
            'tax_rate' => 10.00,
            'tax_country_code' => 'TST',
            'tax_type' => 'vat',
            'total' => 120.00,
        ]);

        $done = $this->actingAs($this->buyer)->postJson('/api/v1/checkout/complete-mock', [
            'order_id' => $orderId,
        ]);
        $done->assertOk();

        $this->assertDatabaseHas('revenue_stream_entries', [
            'reference' => 'COMMERCE_'.$orderNumber,
            'stream_type' => 'commerce',
            'gross_amount_cents' => 10000,
            'tax_amount_cents' => 1000,
            'country_code' => 'TST',
        ]);

        $this->assertDatabaseHas('tax_liabilities', [
            'period_identifier' => now()->format('Y-m'),
            'country_code' => 'TST',
            'currency' => 'USD',
            'tax_type' => 'VAT',
            'taxable_base_cents' => 10000,
            'tax_collected_cents' => 1000,
        ]);
    }

    public function test_intent_is_idempotent_across_ledger_records(): void
    {
        $key = 'vat-idem-dup-'.rand(1000, 9999);

        $intent = $this->actingAs($this->buyer)->postJson('/api/v1/checkout/intent', [
            'product_id' => $this->product->id,
            'payment_provider' => 'mock',
            'idempotency_key' => $key,
            'country_code' => 'TST',
        ]);
        $intent->assertStatus(201);
        $orderNumber = $intent->json('data.data.order.order_number');

        // Duplicate intent must resolve to the same (already existing) order.
        $dup = $this->actingAs($this->buyer)->postJson('/api/v1/checkout/intent', [
            'product_id' => $this->product->id,
            'payment_provider' => 'mock',
            'idempotency_key' => $key,
            'country_code' => 'TST',
        ]);
        $dup->assertOk();

        // Complete the order twice; ledger journal must only be written once.
        $orderId = $intent->json('data.data.order.id');
        $this->actingAs($this->buyer)->postJson('/api/v1/checkout/complete-mock', ['order_id' => $orderId])->assertOk();
        $this->actingAs($this->buyer)->postJson('/api/v1/checkout/complete-mock', ['order_id' => $orderId])->assertOk();

        $this->assertDatabaseCount('revenue_stream_entries', 1);
        $this->assertSame(
            1,
            \App\Models\RevenueStreamEntry::where('reference', 'COMMERCE_'.$orderNumber)->count()
        );
    }
}