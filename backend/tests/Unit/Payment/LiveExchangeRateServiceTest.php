<?php

namespace Tests\Unit\Payment;

use App\Models\CurrencyExchangeRate;
use App\Services\Payment\LiveExchangeRateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LiveExchangeRateServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_get_rate_returns_one_for_identical_currency(): void
    {
        $service = new LiveExchangeRateService();
        $this->assertEquals(1.0, $service->getRate('USD', 'USD'));
        $this->assertEquals(1.0, $service->getRate('NGN', 'NGN'));
    }

    public function test_get_rate_calculates_cross_rate_via_usd(): void
    {
        CurrencyExchangeRate::updateOrCreate(['from_currency' => 'USD', 'to_currency' => 'NGN'], ['rate' => 1500.0]);
        CurrencyExchangeRate::updateOrCreate(['from_currency' => 'USD', 'to_currency' => 'EUR'], ['rate' => 0.90]);

        $service = new LiveExchangeRateService();

        // USD to NGN
        $this->assertEquals(1500.0, $service->getRate('USD', 'NGN'));

        // NGN to USD (inverse)
        $this->assertEquals(round(1.0 / 1500.0, 8), $service->getRate('NGN', 'USD'));

        // EUR to NGN cross-rate: (1 / 0.90) * 1500.0
        $expectedEurToNgn = round((1.0 / 0.90) * 1500.0, 8);
        $this->assertEquals($expectedEurToNgn, $service->getRate('EUR', 'NGN'));
    }

    public function test_convert_minor_units(): void
    {
        CurrencyExchangeRate::updateOrCreate(['from_currency' => 'USD', 'to_currency' => 'NGN'], ['rate' => 1500.0]);

        $service = new LiveExchangeRateService();
        $result = $service->convert(1000, 'USD', 'NGN', fromMinorUnits: true, toMinorUnits: true);

        // 1000 cents ($10.00) * 1500 = ₦15,000.00 = 1,500,000 kobo
        $this->assertEquals(1500000, $result['converted_amount']);
        $this->assertEquals(15000.0, $result['converted_major']);
        $this->assertEquals('₦15,000.00', $result['formatted']);
    }
}
