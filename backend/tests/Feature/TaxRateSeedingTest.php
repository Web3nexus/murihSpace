<?php

namespace Tests\Feature;

use App\Models\Country;
use App\Models\TaxRate;
use App\Services\Tax\TaxCalculationService;
use Database\Seeders\TaxRateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaxRateSeedingTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_country_rate_from_the_rates_file_is_used_at_checkout(): void
    {
        Country::create(['iso2' => 'CI', 'iso3' => 'CIV', 'name' => "Ivory Coast (Côte d'Ivoire)"]);

        (new TaxRateSeeder())->run();

        $result = app(TaxCalculationService::class)->resolveCheckoutTax(10000, 'CI', null, 'commerce', true);

        $this->assertSame(18.0, $result['tax_rate_percentage']);
        $this->assertSame(1800, $result['tax_amount_cents']);
    }

    public function test_a_country_with_no_rate_on_file_is_flagged_for_confirmation(): void
    {
        Country::create(['iso2' => 'AX', 'iso3' => 'ALA', 'name' => 'Aland Islands']);

        (new TaxRateSeeder())->run();

        $rule = TaxRate::where('country_code', 'ALA')->firstOrFail();
        $this->assertSame(0.0, (float) $rule->standard_rate_percentage);
        $this->assertStringContainsString('Confirm the rate', (string) $rule->notes);
    }

    public function test_a_checkout_in_a_country_with_no_rate_alerts_an_admin_once_a_day(): void
    {
        Country::create(['iso2' => 'AX', 'iso3' => 'ALA', 'name' => 'Aland Islands']);
        (new TaxRateSeeder())->run();
        $this->mock(\App\Services\AdminAlertService::class, function ($mock) {
            $mock->shouldReceive('dispatch')->once()->withArgs(fn (array $data) => $data['event_type'] === 'tax_rate_missing');
        });

        $service = app(TaxCalculationService::class);
        $service->resolveCheckoutTax(10000, 'AX', null, 'commerce', true);
        $service->resolveCheckoutTax(20000, 'AX', null, 'commerce', true);
    }
}
