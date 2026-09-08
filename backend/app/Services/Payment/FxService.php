<?php

namespace App\Services\Payment;

use App\Models\CurrencyExchangeRate;
use App\Models\FxQuote;
use App\Services\Payment\Exceptions\PaymentException;
use Illuminate\Support\Str;

class FxService
{
    /**
     * Platform markup percentage (e.g. 1.0% spread).
     */
    public const MARKUP_PERCENT = 0.01;

    /**
     * Quote validity TTL in minutes.
     */
    public const QUOTE_TTL_MINUTES = 15;

    /**
     * Generates a binding, locked FX quote.
     */
    public function generateQuote(string $sourceCurrency, string $destinationCurrency, int $sourceAmountMinor): FxQuote
    {
        $src = strtoupper($sourceCurrency);
        $dst = strtoupper($destinationCurrency);

        if ($src === $dst) {
            return FxQuote::create([
                'quote_reference' => 'FXQ-'.strtoupper(Str::random(12)),
                'source_currency' => $src,
                'destination_currency' => $dst,
                'rate' => 1.00000000,
                'provider' => 'internal',
                'source_amount' => $sourceAmountMinor,
                'destination_amount' => $sourceAmountMinor,
                'fee' => 0,
                'markup' => 0,
                'expires_at' => now()->addMinutes(self::QUOTE_TTL_MINUTES),
            ]);
        }

        // Look up validated market rate from currency_exchange_rates table
        $rateRecord = CurrencyExchangeRate::where('from_currency', $src)
            ->where('to_currency', $dst)
            ->first();

        $baseRate = $rateRecord ? (float) $rateRecord->rate : null;

        if (! $baseRate) {
            // Check inverse
            $inverse = CurrencyExchangeRate::where('from_currency', $dst)
                ->where('to_currency', $src)
                ->first();

            if ($inverse && (float) $inverse->rate > 0) {
                $baseRate = 1 / (float) $inverse->rate;
            } else {
                throw new PaymentException("Exchange rate from {$src} to {$dst} is currently unavailable.");
            }
        }

        // Apply controlled platform markup
        $markupRate = $baseRate * (1 - self::MARKUP_PERCENT);
        $rawDestAmount = $sourceAmountMinor * $markupRate;
        $destAmountMinor = (int) round($rawDestAmount);
        $markupMinor = (int) round($sourceAmountMinor * $baseRate * self::MARKUP_PERCENT);

        return FxQuote::create([
            'quote_reference' => 'FXQ-'.strtoupper(Str::random(12)),
            'source_currency' => $src,
            'destination_currency' => $dst,
            'rate' => $markupRate,
            'provider' => 'internal_treasury',
            'source_amount' => $sourceAmountMinor,
            'destination_amount' => $destAmountMinor,
            'fee' => 0,
            'markup' => $markupMinor,
            'expires_at' => now()->addMinutes(self::QUOTE_TTL_MINUTES),
        ]);
    }

    /**
     * Executes and consumes an existing quote.
     */
    public function executeQuote(string $quoteReference): FxQuote
    {
        $quote = FxQuote::where('quote_reference', $quoteReference)->firstOrFail();

        if ($quote->isExpired()) {
            throw new PaymentException("FX quote '{$quoteReference}' has expired. Please generate a new quote.");
        }

        if ($quote->executed_at !== null) {
            throw new PaymentException("FX quote '{$quoteReference}' has already been executed.");
        }

        $quote->update(['executed_at' => now()]);

        return $quote;
    }
}
