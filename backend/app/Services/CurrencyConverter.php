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
        $rateService = app(\App\Services\Payment\LiveExchangeRateService::class);
        return $rateService->getRate($from, $to);
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
