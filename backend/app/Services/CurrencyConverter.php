<?php

namespace App\Services;

use App\Models\CurrencyExchangeRate;
use Illuminate\Support\Facades\Cache;

class CurrencyConverter
{
    private const CACHE_TTL = 3600;

    private array $symbols = [
        'NGN' => '₦',
        'USD' => '$',
        'GBP' => '£',
        'EUR' => '€',
        'GHS' => 'GH₵',
        'KES' => 'KSh',
        'ZAR' => 'R',
        'XOF' => 'CFA',
    ];

    public function convert(int|float $amount, string $from, string $to, bool $fromCents = true): array
    {
        $from = strtoupper($from);
        $to = strtoupper($to);

        $value = $fromCents ? $amount / 100 : $amount;

        if ($from === $to) {
            return [
                'amount' => round($value, 2),
                'formatted' => $this->format($value, $to),
                'currency' => $to,
                'rate' => 1.0,
            ];
        }

        $rate = $this->getRate($from, $to);

        if ($rate === null) {
            $converted = $value;
        } else {
            $converted = $value * $rate;
        }

        return [
            'amount' => round($converted, 2),
            'formatted' => $this->format($converted, $to),
            'currency' => $to,
            'rate' => $rate,
        ];
    }

    public function format(int|float $amount, string $currency): string
    {
        $sym = $this->symbols[strtoupper($currency)] ?? $currency . ' ';
        return $sym . number_format((float) $amount, 2);
    }

    public function getRate(string $from, string $to): ?float
    {
        $from = strtoupper($from);
        $to = strtoupper($to);

        if ($from === $to) {
            return 1.0;
        }

        $cacheKey = "exchange_rate:{$from}:{$to}";

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($from, $to) {
            $direct = $this->lookup($from, $to);
            if ($direct !== null) {
                return $direct;
            }

            if ($from !== 'USD' && $to !== 'USD') {
                $viaUsdFrom = $this->lookup($from, 'USD');
                $viaUsdTo = $this->lookup('USD', $to);
                if ($viaUsdFrom !== null && $viaUsdTo !== null) {
                    return $viaUsdFrom * $viaUsdTo;
                }
            }

            return null;
        });
    }

    private function lookup(string $from, string $to): ?float
    {
        $rate = CurrencyExchangeRate::where('from_currency', $from)
            ->where('to_currency', $to)
            ->first();

        return $rate ? (float) $rate->rate : null;
    }

    public function getSupportedCurrencies(): array
    {
        return array_keys($this->symbols);
    }

    public function getSymbol(string $currency): string
    {
        return $this->symbols[strtoupper($currency)] ?? $currency;
    }
}
