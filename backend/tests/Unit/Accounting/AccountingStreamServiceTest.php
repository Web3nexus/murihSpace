<?php

namespace Tests\Unit\Accounting;

use App\Models\RevenueStreamEntry;
use App\Models\TaxRate;
use App\Services\Accounting\AccountingStreamService;
use App\Services\Tax\TaxCalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountingStreamServiceTest extends TestCase
{
    use RefreshDatabase;

    protected AccountingStreamService $accountingService;

    protected function setUp(): void
    {
        parent::setUp();
        $taxService = new TaxCalculationService();
        $this->accountingService = new AccountingStreamService($taxService);

        TaxRate::create([
            'country_code'             => 'NGA',
            'country_name'             => 'Nigeria',
            'tax_name'                 => 'Value Added Tax (VAT)',
            'standard_rate_percentage' => 7.50,
            'wht_rate_percentage'      => 5.00,
            'is_active'                => true,
        ]);
    }

    public function test_records_revenue_entry_with_automatic_tax(): void
    {
        $entry = $this->accountingService->recordRevenueEntry([
            'stream_type'        => 'commerce',
            'gross_amount_cents' => 10000,
            'platform_fee_cents' => 1000, // 10% platform take
            'country_code'       => 'NGA',
            'currency'           => 'NGN',
            'source_system'      => 'backend',
            'source_id'          => 'ORD_12345',
        ]);

        $this->assertInstanceOf(RevenueStreamEntry::class, $entry);
        $this->assertEquals('commerce', $entry->stream_type);
        $this->assertEquals(10000, $entry->gross_amount_cents);
        $this->assertEquals(750, $entry->tax_amount_cents); // 7.5% of 10000
        $this->assertDatabaseHas('revenue_stream_entries', [
            'id'          => $entry->id,
            'stream_type' => 'commerce',
        ]);
    }

    public function test_records_ad_revenue_from_ads_backend(): void
    {
        $entry = $this->accountingService->recordRevenueEntry([
            'stream_type'        => 'ads',
            'gross_amount_cents' => 5000,
            'source_system'      => 'ads-backend',
            'source_id'          => 'CAMP_999',
            'currency'           => 'USD',
            'country_code'       => 'USA',
            'metadata'           => ['campaign_name' => 'Summer Sale Promo'],
        ]);

        $this->assertEquals('ads', $entry->stream_type);
        $this->assertEquals('ads-backend', $entry->source_system);
        $this->assertEquals(5000, $entry->platform_fee_cents); // Ads = 100% platform gross
    }

    public function test_aggregates_stream_summary_correctly(): void
    {
        // Add one ad entry and one commerce entry
        $this->accountingService->recordRevenueEntry([
            'stream_type'        => 'ads',
            'gross_amount_cents' => 10000,
            'currency'           => 'USD',
        ]);

        $this->accountingService->recordRevenueEntry([
            'stream_type'                 => 'commerce',
            'gross_amount_cents'          => 20000,
            'platform_fee_cents'          => 2000,
            'creator_vendor_amount_cents' => 18000,
            'currency'                    => 'USD',
        ]);

        $summary = $this->accountingService->getStreamSummary('USD');

        $this->assertEquals(30000, $summary['summary']['total_gross_cents']);
        $this->assertCount(6, $summary['streams']); // 6 predefined streams

        $adsItem = collect($summary['streams'])->firstWhere('stream_type', 'ads');
        $this->assertEquals(10000, $adsItem['gross_amount_cents']);

        $commerceItem = collect($summary['streams'])->firstWhere('stream_type', 'commerce');
        $this->assertEquals(20000, $commerceItem['gross_amount_cents']);
        $this->assertEquals(2000, $commerceItem['platform_fee_cents']);
    }
}

