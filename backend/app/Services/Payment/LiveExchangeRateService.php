<?php

namespace App\Services\Payment;

use App\Models\CurrencyExchangeRate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LiveExchangeRateService
{
    private const CACHE_TTL_SECONDS = 3600; // 1 hour
    private const API_URL = 'https://open.er-api.com/v6/latest/USD';

    /**
     * Supported fiat currencies for our African & Global user base.
     */
    public const SUPPORTED_CURRENCIES = [
        'USD' => 'US Dollar',
        'NGN' => 'Nigerian Naira',
        'KES' => 'Kenyan Shilling',
        'GHS' => 'Ghanaian Cedi',
        'ZAR' => 'South African Rand',
        'EUR' => 'Euro',
        'GBP' => 'British Pound',
        'CAD' => 'Canadian Dollar',
        'AUD' => 'Australian Dollar',
        'UGX' => 'Ugandan Shilling',
        'TZS' => 'Tanzanian Shilling',
        'RWF' => 'Rwandan Franc',
        'XOF' => 'West African CFA',
    ];

    /**
     * Fetch live rates from external feed and update the database and cache.
     *
     * @return array<string, float> Map of currency code to rate per 1 USD
     */
    public function syncRates(): array
    {
        try {
            $response = Http::timeout(10)->get(self::API_URL);

            if ($response->successful() && $response->json('result') === 'success') {
                $rawRates = $response->json('rates') ?? [];
                $synced = [];

                foreach (array_keys(self::SUPPORTED_CURRENCIES) as $code) {
                    if ($code === 'USD') {
                        $rate = 1.0;
                    } elseif (isset($rawRates[$code]) && (float) $rawRates[$code] > 0) {
                        $rate = (float) $rawRates[$code];
                    } else {
                        continue;
                    }

                    $synced[$code] = $rate;

                    // Update USD -> TARGET
                    CurrencyExchangeRate::updateOrCreate(
                        ['from_currency' => 'USD', 'to_currency' => $code],
                        ['rate' => $rate]
                    );

                    // Update TARGET -> USD (inverse)
                    if ($code !== 'USD' && $rate > 0) {
                        CurrencyExchangeRate::updateOrCreate(
                            ['from_currency' => $code, 'to_currency' => 'USD'],
                            ['rate' => round(1.0 / $rate, 8)]
                        );
                    }
                }

                Cache::put('fx_rates_usd_all', $synced, self::CACHE_TTL_SECONDS);
                Log::info('Live exchange rates successfully synced', ['currencies' => count($synced)]);

                return $synced;
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to sync live rates from primary provider: ' . $e->getMessage());
        }

        // Return cached or fallback DB rates
        return $this->getRatesFromDb();
    }

    /**
     * Get live exchange rate between any two currencies.
     */
    public function getRate(string $from, string $to): float
    {
        $from = strtoupper($from);
        $to = strtoupper($to);

        if ($from === $to) {
            return 1.0;
        }

        $rates = Cache::remember('fx_rates_usd_all', self::CACHE_TTL_SECONDS, function () {
            return $this->getRatesFromDb();
        });

        // If USD is the base
        if ($from === 'USD' && isset($rates[$to])) {
            return (float) $rates[$to];
        }

        // If target is USD
        if ($to === 'USD' && isset($rates[$from]) && (float) $rates[$from] > 0) {
            return round(1.0 / (float) $rates[$from], 8);
        }

        // Cross-rate via USD: FROM -> USD -> TO
        if (isset($rates[$from]) && isset($rates[$to]) && (float) $rates[$from] > 0) {
            $fromToUsd = 1.0 / (float) $rates[$from];
            return round($fromToUsd * (float) $rates[$to], 8);
        }

        // Fallback to database direct lookup
        $record = CurrencyExchangeRate::where('from_currency', $from)
            ->where('to_currency', $to)
            ->first();

        if ($record && (float) $record->rate > 0) {
            return (float) $record->rate;
        }

        // Hardcoded safety anchors if database is completely empty
        return $this->getHardcodedFallbackRate($from, $to);
    }

    /**
     * Converts an amount (in minor units or major units) between two currencies.
     */
    public function convert(
        int|float $amount,
        string $from,
        string $to,
        bool $fromMinorUnits = true,
        bool $toMinorUnits = true
    ): array {
        $from = strtoupper($from);
        $to = strtoupper($to);

        $majorAmount = $fromMinorUnits ? ((float) $amount) / 100.0 : (float) $amount;
        $rate = $this->getRate($from, $to);
        $convertedMajor = $majorAmount * $rate;
        $convertedMinor = (int) round($convertedMajor * 100);

        return [
            'from_currency'      => $from,
            'to_currency'        => $to,
            'source_amount'      => $amount,
            'rate'               => $rate,
            'converted_amount'   => $toMinorUnits ? $convertedMinor : round($convertedMajor, 2),
            'converted_major'    => round($convertedMajor, 2),
            'formatted'          => $this->format($convertedMajor, $to),
        ];
    }

    /**
     * Retrieve all rates against USD from the database.
     */
    public function getRatesFromDb(): array
    {
        $dbRates = CurrencyExchangeRate::where('from_currency', 'USD')->get();
        $rates = ['USD' => 1.0];

        foreach ($dbRates as $r) {
            $rates[$r->to_currency] = (float) $r->rate;
        }

        return $rates;
    }

    /**
     * Format an amount in major units with appropriate symbol.
     */
    public function format(float $amount, string $currency): string
    {
        $symbols = [
            'USD' => '$',
            'NGN' => '₦',
            'GBP' => '£',
            'EUR' => '€',
            'GHS' => 'GH₵',
            'KES' => 'KSh',
            'ZAR' => 'R',
            'CAD' => 'CA$',
            'AUD' => 'A$',
            'XOF' => 'CFA',
        ];

        $sym = $symbols[strtoupper($currency)] ?? strtoupper($currency) . ' ';
        return $sym . number_format($amount, 2);
    }

    private function getHardcodedFallbackRate(string $from, string $to): float
    {
        $usdRates = [
            'USD' => 1.0,
            'NGN' => 1550.0,
            'KES' => 130.0,
            'GHS' => 15.5,
            'ZAR' => 18.2,
            'EUR' => 0.92,
            'GBP' => 0.78,
            'CAD' => 1.36,
            'AUD' => 1.50,
        ];

        if ($from === 'USD') {
            return $usdRates[$to] ?? 1.0;
        }

        if ($to === 'USD' && isset($usdRates[$from]) && $usdRates[$from] > 0) {
            return round(1.0 / $usdRates[$from], 8);
        }

        return 1.0;
    }
}
