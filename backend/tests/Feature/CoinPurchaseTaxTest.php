<?php

namespace Tests\Feature;

use App\Models\CoinPack;
use App\Models\TaxRate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CoinPurchaseTaxTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private CoinPack $pack;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create(['email_verified_at' => now()]);

        $this->pack = CoinPack::create([
            'name' => 'Tester Pack',
            'coins' => 100,
            'bonus_coins' => 0,
            'price' => 500, // USD cents
            'currency' => 'USD',
            'is_active' => true,
            'sort_order' => 1,
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

    public function test_estimate_returns_vat_breakdown(): void
    {
        $res = $this->actingAs($this->user)->postJson('/api/v1/coins/purchase-estimate', [
            'coin_pack_id' => $this->pack->id,
            'country_code' => 'TST',
        ]);

        $res->assertOk();
        $res->assertJsonPath('data.data.tax', 50);
        $res->assertJsonPath('data.data.tax_rate', 10);
        $res->assertJsonPath('data.data.tax_country_code', 'TST');
        $res->assertJsonPath('data.data.total_minor', 550);
    }

    public function test_purchase_applies_vat_and_records_tax_liability(): void
    {
        $res = $this->actingAs($this->user)->postJson('/api/v1/coins/purchase', [
            'coin_pack_id' => $this->pack->id,
            'country_code' => 'TST',
            'reference' => 'CP-TEST-VAT-1',
        ]);

        $res->assertStatus(201);
        $purchaseId = $res->json('data.data.purchase.id');

        $this->assertDatabaseHas('coin_purchases', [
            'id' => $purchaseId,
            'amount_paid' => 500,
            'tax' => 50,
            'total_charged' => 550,
            'tax_country_code' => 'TST',
            'tax_type' => 'vat',
        ]);

        $this->assertDatabaseHas('revenue_stream_entries', [
            'reference' => 'COIN_CP-TEST-VAT-1',
            'stream_type' => 'commerce',
            'gross_amount_cents' => 500,
            'tax_amount_cents' => 50,
            'country_code' => 'TST',
        ]);

        $this->assertDatabaseHas('tax_liabilities', [
            'period_identifier' => now()->format('Y-m'),
            'country_code' => 'TST',
            'currency' => 'USD',
            'tax_type' => 'VAT',
            'taxable_base_cents' => 500,
            'tax_collected_cents' => 50,
        ]);
    }

    public function test_custom_purchase_uses_profile_country_when_no_country_given(): void
    {
        \App\Models\Country::create([
            'iso2' => 'NG',
            'iso3' => 'NGA',
            'name' => 'Nigeria',
        ]);
        $this->user->update(['country' => 'NG']);

        $res = $this->actingAs($this->user)->postJson('/api/v1/coins/purchase-custom', [
            'amount_usd' => 10.00,
            'reference' => 'CC-TEST-VAT-1',
        ]);

        $res->assertStatus(201);
        $purchaseId = $res->json('data.data.purchase.id');

        $this->assertDatabaseHas('coin_purchases', [
            'id' => $purchaseId,
            'amount_paid' => 1000,
            'tax_country_code' => 'NGA',
        ]);
    }
}