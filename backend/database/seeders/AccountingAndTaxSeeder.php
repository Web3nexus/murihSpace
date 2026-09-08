<?php

namespace Database\Seeders;

use App\Models\TaxRate;
use Illuminate\Database\Seeder;

class AccountingAndTaxSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $taxRates = [
            [
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
                'tax_number_format'        => 'TIN: 8-12 digits',
                'notes'                    => 'Federal Inland Revenue Service (FIRS) statutory rate. 5% WHT on creator payouts.',
            ],
            [
                'country_code'             => 'GBR',
                'country_name'             => 'United Kingdom',
                'tax_name'                 => 'Value Added Tax (VAT)',
                'standard_rate_percentage' => 20.00,
                'wht_rate_percentage'      => 0.00,
                'stream_rates'             => [
                    'ads'           => 20.00,
                    'commerce'      => 20.00,
                    'subscriptions' => 20.00,
                    'tips_gifts'    => 0.00,
                    'verification'  => 20.00,
                ],
                'is_active'                => true,
                'tax_number_format'        => 'GB999999999',
                'notes'                    => 'HMRC standard rate. Digital services threshold applicable.',
            ],
            [
                'country_code'             => 'USA',
                'country_name'             => 'United States',
                'tax_name'                 => 'State & Local Sales Tax',
                'standard_rate_percentage' => 0.00, // Destination/nexus based
                'wht_rate_percentage'      => 0.00, // 1099-K / 1099-NEC reporting applies
                'stream_rates'             => [
                    'ads'           => 0.00,
                    'commerce'      => 0.00,
                    'subscriptions' => 0.00,
                    'tips_gifts'    => 0.00,
                    'verification'  => 0.00,
                ],
                'is_active'                => true,
                'tax_number_format'        => 'EIN / SSN',
                'notes'                    => 'IRS economic nexus and 1099-K filing thresholds apply.',
            ],
            [
                'country_code'             => 'KEN',
                'country_name'             => 'Kenya',
                'tax_name'                 => 'Value Added Tax (VAT)',
                'standard_rate_percentage' => 16.00,
                'wht_rate_percentage'      => 5.00,
                'stream_rates'             => [
                    'ads'           => 16.00,
                    'commerce'      => 16.00,
                    'subscriptions' => 16.00,
                    'tips_gifts'    => 0.00,
                    'verification'  => 16.00,
                ],
                'is_active'                => true,
                'tax_number_format'        => 'KRA PIN',
                'notes'                    => 'Kenya Revenue Authority (KRA) digital services and withholding tax rules.',
            ],
            [
                'country_code'             => 'ZAF',
                'country_name'             => 'South Africa',
                'tax_name'                 => 'Value Added Tax (VAT)',
                'standard_rate_percentage' => 15.00,
                'wht_rate_percentage'      => 15.00,
                'stream_rates'             => [
                    'ads'           => 15.00,
                    'commerce'      => 15.00,
                    'subscriptions' => 15.00,
                    'tips_gifts'    => 0.00,
                    'verification'  => 15.00,
                ],
                'is_active'                => true,
                'tax_number_format'        => 'SARS Tax Ref',
                'notes'                    => 'SARS electronic services regulations and cross-border withholding tax.',
            ],
            [
                'country_code'             => 'GHA',
                'country_name'             => 'Ghana',
                'tax_name'                 => 'Value Added Tax (VAT)',
                'standard_rate_percentage' => 15.00,
                'wht_rate_percentage'      => 7.50,
                'stream_rates'             => [
                    'ads'           => 15.00,
                    'commerce'      => 15.00,
                    'subscriptions' => 15.00,
                    'tips_gifts'    => 0.00,
                    'verification'  => 15.00,
                ],
                'is_active'                => true,
                'tax_number_format'        => 'GRA TIN',
                'notes'                    => 'Ghana Revenue Authority standard VAT and electronic levy.',
            ],
        ];

        foreach ($taxRates as $rate) {
            TaxRate::updateOrCreate(
                ['country_code' => $rate['country_code'], 'tax_name' => $rate['tax_name']],
                $rate
            );
        }
    }
}

