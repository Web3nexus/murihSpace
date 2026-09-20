<?php

namespace Tests\Feature\Accounting;

use App\Models\TaxRate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTaxRatesSearchTest extends TestCase
{
    use RefreshDatabase;

    protected User $accountant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountant = User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'finance_admin',
            'admin_permissions' => ['accounting', 'tax'],
        ]);

        foreach ([
            ['NGA', 'Nigeria'],
            ['GBR', 'United Kingdom'],
            ['NLD', 'Netherlands'],
            ['NZL', 'New Zealand'],
            ['USA', 'United States'],
        ] as [$code, $name]) {
            TaxRate::create([
                'country_code' => $code,
                'country_name' => $name,
                'tax_name' => 'Value Added Tax (VAT)',
                'standard_rate_percentage' => 7.5,
                'wht_rate_percentage' => 5.0,
                'is_active' => true,
            ]);
        }
    }

    public function test_rates_endpoint_paginates(): void
    {
        $res = $this->actingAs($this->accountant)->getJson('/api/v1/securegate/tax/rates?page=1&per_page=2');

        $res->assertOk();
        $res->assertJsonPath('data.meta.total', 5);
        $res->assertJsonPath('data.meta.per_page', 2);
        $res->assertJsonPath('data.meta.current_page', 1);
        $res->assertJsonPath('data.meta.last_page', 3);
        $this->assertCount(2, $res->json('data.rates'));
    }

    public function test_rates_endpoint_searches_country_name(): void
    {
        $res = $this->actingAs($this->accountant)->getJson('/api/v1/securegate/tax/rates?search=nig&page=1&per_page=25');

        $res->assertOk();
        $res->assertJsonPath('data.meta.total', 1);
        $res->assertJsonPath('data.meta.last_page', 1);
        $codes = collect($res->json('data.rates'))->pluck('country_code')->all();
        $this->assertEquals(['NGA'], $codes);
    }

    public function test_rates_endpoint_searches_country_code_or_tax_name(): void
    {
        $res = $this->actingAs($this->accountant)->getJson('/api/v1/securegate/tax/rates?search=GBR');

        $res->assertOk();
        $res->assertJsonPath('data.meta.total', 1);
        $res->assertJsonPath('data.rates.0.country_name', 'United Kingdom');

        $res2 = $this->actingAs($this->accountant)->getJson('/api/v1/securegate/tax/rates?search=withholding');
        $res2->assertOk();
        $res2->assertJsonPath('data.meta.total', 0);
    }
}