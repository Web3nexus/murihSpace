<?php

namespace Database\Seeders;

use App\Models\Country;
use App\Models\TaxRate;
use Illuminate\Database\Seeder;

class TaxRateSeeder extends Seeder
{
    /**
     * Import statutory VAT / GST / sales-tax rates for every country
     * that exists in the countries table (from database/data/tax_rates.json).
     *
     * Countries without an explicit rule default to a zero-rated tax rule so
     * every jurisdiction has a resolvable record for accounting & filing.
     */
    public function run(): void
    {
        $file = database_path('data/tax_rates.json');

        if (! is_file($file)) {
            $this->command?->error("Missing data file: {$file}");

            return;
        }

        $rules = collect(json_decode((string) file_get_contents($file), true))
            ->keyBy(fn (array $row) => strtoupper((string) $row['iso3']));

        $created = 0;
        $updated = 0;

        foreach (Country::orderBy('name')->get() as $country) {
            $iso3 = strtoupper((string) $country->iso3);
            $row = $rules->get($iso3);

            $rate = $row['rate'] ?? 0.00;
            $rate = (float) $rate;
            $taxName = $row['axe'] ?? ($rate > 0 ? 'Value Added Tax (VAT)' : 'No VAT/GST');
            $notes = $row['note'] ?? null;

            $streamRates = [
                'ads'           => $rate,
                'commerce'      => $rate,
                'subscriptions' => $rate,
                'tips_gifts'    => 0.00,
                'verification'  => $rate,
            ];

            $result = TaxRate::updateOrCreate(
                [
                    'country_code' => $iso3,
                    'tax_name'     => $taxName,
                ],
                [
                    'country_name'             => $country->name,
                    'standard_rate_percentage' => $rate,
                    'wht_rate_percentage'      => (float) ($row['wht'] ?? 0.00),
                    'stream_rates'             => $streamRates,
                    'is_active'                => true,
                    'tax_number_format'        => null,
                    'notes'                    => $notes,
                ]
            );

            $result->wasRecentlyCreated ? $created++ : $updated++;
        }

        $this->command?->info("Tax rates synced. {$created} created, {$updated} updated for ".Country::count().' countries.');
    }
}