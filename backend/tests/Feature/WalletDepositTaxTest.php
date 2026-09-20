<?php

namespace Tests\Feature;

use App\Models\TaxRate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WalletDepositTaxTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create(['email_verified_at' => now()]);

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

    public function test_deposit_estimate_returns_vat_breakdown(): void
    {
        $res = $this->actingAs($this->user)->postJson('/api/v1/wallet/deposit-estimate', [
            'amount' => 1000,
            'country_code' => 'TST',
        ]);

        $res->assertOk();
        $res->assertJsonPath('data.data.tax', 100);
        $res->assertJsonPath('data.data.tax_rate', 10);
        $res->assertJsonPath('data.data.tax_country_code', 'TST');
        $res->assertJsonPath('data.data.total_charged', 1100);
    }

    public function test_deposit_applies_vat_and_records_tax_liability(): void
    {
        $res = $this->actingAs($this->user)->postJson('/api/v1/wallet/deposit', [
            'amount' => 5000,
            'country_code' => 'TST',
            'idempotency_key' => 'DEP-TEST-VAT-1',
        ]);

        $res->assertStatus(201);
        $depositId = $res->json('data.data.deposit.id');

        $this->assertDatabaseHas('deposit_transactions', [
            'id' => $depositId,
            'amount' => 5000,
            'tax' => 500,
            'total_charged' => 5500,
            'tax_country_code' => 'TST',
            'tax_type' => 'vat',
        ]);

        $this->assertDatabaseHas('revenue_stream_entries', [
            'reference' => 'DEP_DEP-TEST-VAT-1',
            'stream_type' => 'commerce',
            'gross_amount_cents' => 5000,
            'tax_amount_cents' => 500,
            'country_code' => 'TST',
        ]);

        $this->assertDatabaseHas('tax_liabilities', [
            'period_identifier' => now()->format('Y-m'),
            'country_code' => 'TST',
            'currency' => 'NGN',
            'tax_type' => 'VAT',
            'taxable_base_cents' => 5000,
            'tax_collected_cents' => 500,
        ]);
    }

    public function test_deposit_falls_back_to_profile_country(): void
    {
        \App\Models\Country::create([
            'iso2' => 'NG',
            'iso3' => 'NGA',
            'name' => 'Nigeria',
        ]);
        $this->user->update(['country' => 'NG']);

        $res = $this->actingAs($this->user)->postJson('/api/v1/wallet/deposit', [
            'amount' => 2000,
            'idempotency_key' => 'DEP-TEST-VAT-2',
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('deposit_transactions', [
            'id' => $res->json('data.data.deposit.id'),
            'tax_country_code' => 'NGA',
        ]);
    }
}