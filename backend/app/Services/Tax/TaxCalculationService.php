<?php

namespace App\Services\Tax;

use App\Models\TaxLiability;
use App\Models\TaxRate;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class TaxCalculationService
{
    /**
     * Resolve the active tax rate rule for a country and stream type.
     */
    public function resolveTaxRate(?string $countryCode, string $streamType = 'other'): ?TaxRate
    {
        if (empty($countryCode)) {
            return null;
        }

        return TaxRate::where('country_code', strtoupper($countryCode))
            ->where('is_active', true)
            ->first();
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
