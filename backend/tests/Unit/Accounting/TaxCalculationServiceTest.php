<?php

namespace Tests\Unit\Accounting;

use App\Models\TaxRate;
use App\Services\Tax\TaxCalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaxCalculationServiceTest extends TestCase
{
    use RefreshDatabase;

    protected TaxCalculationService $taxService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->taxService = new TaxCalculationService();

        TaxRate::create([
            'country_code'             => 'NGA',
            'country_name'             => 'Nigeria',
            'tax_name'                 => 'Value Added Tax (VAT)',
            'standard_rate_percentage' => 7.50,
            'wht_rate_percentage'      => 5.00,
            'stream_rates'             => [
                'ads'           => 7.50,
                'commerce'      => 7.50,
                'subscriptions' => 7.50,
                'tips_gifts'    => 0.00,
                'verification'  => 7.50,
            ],
            'is_active'                => true,
        ]);

        TaxRate::create([
            'country_code'             => 'GBR',
            'country_name'             => 'United Kingdom',
            'tax_name'                 => 'Value Added Tax (VAT)',
            'standard_rate_percentage' => 20.00,
            'wht_rate_percentage'      => 0.00,
            'is_active'                => true,
        ]);
    }

    public function test_calculates_vat_for_nigeria_standard_stream(): void
    {
        // 10,000 NGN (100,000 kobo) * 7.5% = 7,500 kobo tax
        $result = $this->taxService->calculateTax(100000, 'NGA', 'ads');

        $this->assertEquals(7500, $result['tax_amount_cents']);
        $this->assertEquals(7.50, $result['tax_rate_applied']);
        $this->assertEquals('vat', $result['tax_type']);
        $this->assertEquals('NGA', $result['country_code']);
    }

    public function test_respects_stream_specific_override_for_tips_as_zero(): void
    {
        // Tips in Nigeria configured with 0.00%
        $result = $this->taxService->calculateTax(50000, 'NGA', 'tips_gifts');

        $this->assertEquals(0, $result['tax_amount_cents']);
        $this->assertEquals(0.00, $result['tax_rate_applied']);
        $this->assertEquals('zero_rated', $result['tax_type']);
    }

    public function test_unconfigured_country_returns_exempt_with_zero_tax(): void
    {
        $result = $this->taxService->calculateTax(5000, 'ZZZ', 'commerce');

        $this->assertEquals(0, $result['tax_amount_cents']);
        $this->assertEquals(0.00, $result['tax_rate_applied']);
        $this->assertEquals('exempt', $result['tax_type']);
    }

    public function test_calculates_withholding_tax_on_payouts(): void
    {
        // 100,000 kobo payout in NGA with 5% WHT = 5,000 kobo WHT, 95,000 kobo net
        $whtResult = $this->taxService->calculateWithholdingTax(100000, 'NGA');

        $this->assertEquals(5000, $whtResult['wht_amount_cents']);
        $this->assertEquals(5.00, $whtResult['wht_rate_applied']);
        $this->assertEquals(95000, $whtResult['net_payout_cents']);
    }

    public function test_withholding_tax_returns_zero_when_rate_is_zero(): void
    {
        // UK has 0.00% WHT
        $whtResult = $this->taxService->calculateWithholdingTax(50000, 'GBR');

        $this->assertEquals(0, $whtResult['wht_amount_cents']);
        $this->assertEquals(50000, $whtResult['net_payout_cents']);
    }
}

