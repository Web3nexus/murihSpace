<?php

namespace App\Services\Tax;

use App\Models\Country;
use App\Models\TaxLiability;
use App\Models\TaxRate;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class TaxCalculationService
{
    /**
     * Normalise a country code to ISO 3166-1 alpha-3.
     * Accepts ISO2 or ISO3 (lower/upper case).
     */
    public function normalizeCountryCode(?string $countryCode): ?string
    {
        if (empty($countryCode)) {
            return null;
        }

        $code = strtoupper(trim($countryCode));

        if (strlen($code) === 3) {
            return $code;
        }

        if (strlen($code) === 2) {
            $country = Country::where('iso2', $code)->first();

            return $country?->iso3 ? strtoupper($country->iso3) : null;
        }

        return null;
    }

    /**
     * Resolve the active tax rate rule for a country and stream type.
     * Accepts ISO2 or ISO3 country codes.
     */
    public function resolveTaxRate(?string $countryCode, string $streamType = 'other'): ?TaxRate
    {
        $iso3 = $this->normalizeCountryCode($countryCode);

        if (empty($iso3)) {
            return null;
        }

        return TaxRate::where('country_code', $iso3)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Calculate VAT / Sales Tax to charge a buyer at checkout.
     *
     * Resolution order:
     *  1. Active statutory rule for the buyer's country (stream-specific rate preferred).
     *  2. The seller's configured storefront rate when no country rule exists.
     *
     * @return array{
     *     tax_amount_cents: int,
     *     tax_rate_percentage: float,
     *     tax_name: ?string,
     *     tax_type: string,
     *     tax_rate_id: ?int,
     *     country_code: ?string,
     *     taxable_base_cents: int
     * }
     */
    public function resolveCheckoutTax(
        int $amountCents,
        ?string $buyerCountryCode,
        ?float $storefrontRatePercentage = null,
        string $streamType = 'commerce'
    ): array {
        $iso3 = $this->normalizeCountryCode($buyerCountryCode);
        $taxRate = $iso3
            ? TaxRate::where('country_code', $iso3)->where('is_active', true)->first()
            : null;

        if ($taxRate) {
            $percentage = (float) $taxRate->standard_rate_percentage;
            if (! empty($taxRate->stream_rates) && isset($taxRate->stream_rates[$streamType])) {
                $percentage = (float) $taxRate->stream_rates[$streamType];
            }

            $result = $this->calculateTax($amountCents, $iso3, $streamType);

            return [
                'tax_amount_cents'    => $result['tax_amount_cents'],
                'tax_rate_percentage' => $percentage,
                'tax_name'            => $taxRate->tax_name,
                'tax_type'            => $result['tax_type'],
                'tax_rate_id'         => $taxRate->id,
                'country_code'        => $iso3,
                'taxable_base_cents'  => $amountCents,
            ];
        }

        // Fallback: seller-configured rate (legacy storefront behaviour)
        $fallback = (float) ($storefrontRatePercentage ?? 0.0);
        $taxAmountCents = $fallback > 0 ? (int) round(($amountCents * $fallback) / 100) : 0;

        return [
            'tax_amount_cents'    => $taxAmountCents,
            'tax_rate_percentage' => $fallback,
            'tax_name'            => $fallback > 0 ? 'Sales Tax (seller configured)' : null,
            'tax_type'            => $fallback > 0 ? 'sales_tax' : 'exempt',
            'tax_rate_id'         => null,
            'country_code'        => $iso3,
            'taxable_base_cents'  => $amountCents,
        ];
    }

    /**
     * Calculate VAT / Sales Tax / Digital Services Tax on an incoming transaction.
     *
     * @return array{
     *     tax_amount_cents: int,
     *     tax_rate_applied: float,
     *     tax_type: string,
     *     tax_rate_id: ?int,
     *     country_code: ?string,
     *     taxable_base_cents: int
     * }
     */
    public function calculateTax(int $amountCents, ?string $countryCode, string $streamType = 'other'): array
    {
        $taxRate = $this->resolveTaxRate($countryCode, $streamType);

        if (! $taxRate) {
            return [
                'tax_amount_cents' => 0,
                'tax_rate_applied' => 0.00,
                'tax_type' => 'exempt',
                'tax_rate_id' => null,
                'country_code' => $countryCode ? strtoupper($countryCode) : null,
                'taxable_base_cents' => $amountCents,
            ];
        }

        // Check for stream-specific override rate, fallback to standard rate
        $percentage = (float) $taxRate->standard_rate_percentage;
        if (! empty($taxRate->stream_rates) && isset($taxRate->stream_rates[$streamType])) {
            $percentage = (float) $taxRate->stream_rates[$streamType];
        }

        if ($percentage <= 0.0) {
            return [
                'tax_amount_cents' => 0,
                'tax_rate_applied' => 0.00,
                'tax_type' => 'zero_rated',
                'tax_rate_id' => $taxRate->id,
                'country_code' => $taxRate->country_code,
                'taxable_base_cents' => $amountCents,
            ];
        }

        // Standard integer minor unit calculation: floor or round
        $taxAmountCents = (int) round(($amountCents * $percentage) / 100);

        return [
            'tax_amount_cents' => $taxAmountCents,
            'tax_rate_applied' => $percentage,
            'tax_type' => strtolower(str_contains(strtolower($taxRate->tax_name), 'vat') ? 'vat' : 'sales_tax'),
            'tax_rate_id' => $taxRate->id,
            'country_code' => $taxRate->country_code,
            'taxable_base_cents' => $amountCents,
        ];
    }

    /**
     * Calculate statutory Withholding Tax (WHT) on an outbound creator/vendor payout.
     *
     * @return array{
     *     wht_amount_cents: int,
     *     wht_rate_applied: float,
     *     net_payout_cents: int
     * }
     */
    public function calculateWithholdingTax(int $payoutAmountCents, ?string $countryCode): array
    {
        $taxRate = $this->resolveTaxRate($countryCode);

        if (! $taxRate || (float) $taxRate->wht_rate_percentage <= 0.0) {
            return [
                'wht_amount_cents' => 0,
                'wht_rate_applied' => 0.00,
                'net_payout_cents' => $payoutAmountCents,
            ];
        }

        $whtRate = (float) $taxRate->wht_rate_percentage;
        $whtAmountCents = (int) round(($payoutAmountCents * $whtRate) / 100);
        $netPayoutCents = max(0, $payoutAmountCents - $whtAmountCents);

        return [
            'wht_amount_cents' => $whtAmountCents,
            'wht_rate_applied' => $whtRate,
            'net_payout_cents' => $netPayoutCents,
        ];
    }

    /**
     * Record or update periodic tax liability in the ledger.
     */
    public function recordTaxLiability(
        string $periodIdentifier,
        string $countryCode,
        string $currency,
        string $taxType,
        int $taxableBaseCents,
        int $taxCollectedCents,
        int $whtWithheldCents = 0
    ): TaxLiability {
        $now = Carbon::now();
        $periodStart = $now->copy()->startOfMonth()->toDateString();
        $periodEnd = $now->copy()->endOfMonth()->toDateString();

        return DB::transaction(function () use (
            $periodIdentifier,
            $countryCode,
            $currency,
            $taxType,
            $taxableBaseCents,
            $taxCollectedCents,
            $whtWithheldCents,
            $periodStart,
            $periodEnd
        ) {
            $liability = TaxLiability::firstOrNew([
                'period_identifier' => $periodIdentifier,
                'country_code' => strtoupper($countryCode),
                'currency' => strtoupper($currency),
                'tax_type' => strtoupper($taxType),
            ]);

            if (! $liability->exists) {
                $liability->period_start = $periodStart;
                $liability->period_end = $periodEnd;
                $liability->status = 'accruing';
            }

            $liability->taxable_base_cents += $taxableBaseCents;
            $liability->tax_collected_cents += $taxCollectedCents;
            $liability->wht_withheld_cents += $whtWithheldCents;
            $liability->save();

            return $liability;
        });
    }
}
