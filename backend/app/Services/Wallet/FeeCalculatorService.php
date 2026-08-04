<?php

namespace App\Services\Wallet;

use App\Models\FeeRule;

class FeeCalculatorService
{
    /**
     * Calculate fee for a given transaction code/type, amount, and optional context.
     * Supports fixed, percentage, fixed_plus_percentage, and tiered rules.
     */
    public function calculate(
        string $codeOrType,
        int $grossAmount,
        string $currency = 'NGN',
        ?string $paymentMethod = null,
        ?string $role = null,
        ?string $walletType = null
    ): array {
        if ($grossAmount <= 0) {
            return $this->zeroFeePayload(0, $currency);
        }

        // Try exact code match first (e.g. DEPOSIT_PAYSTACK), then fallback to transaction_type or code prefix
        $rule = FeeRule::active()
            ->where(function ($q) use ($codeOrType) {
                $q->where('code', $codeOrType)
                  ->orWhere('transaction_type', strtolower($codeOrType))
                  ->orWhere('code', 'LIKE', $codeOrType . '%');
            })
            ->when($paymentMethod, fn ($q) => $q->where(fn ($sub) => $sub->whereNull('payment_method')->orWhere('payment_method', $paymentMethod)))
            ->when($role, fn ($q) => $q->where(fn ($sub) => $sub->whereNull('role')->orWhere('role', $role)))
            ->when($walletType, fn ($q) => $q->where(fn ($sub) => $sub->whereNull('wallet_type')->orWhere('wallet_type', $walletType)))
            ->first();

        if (! $rule) {
            return $this->zeroFeePayload($grossAmount, $currency);
        }

        $fee = 0;

        if ($rule->fee_type === 'fixed') {
            $fee = $rule->fixed_amount;
        } elseif ($rule->fee_type === 'percentage') {
            $fee = (int) round(($grossAmount * $rule->percentage) / 100);
        } elseif ($rule->fee_type === 'fixed_plus_percentage') {
            $percFee = (int) round(($grossAmount * $rule->percentage) / 100);
            $fee     = $rule->fixed_amount + $percFee;
        } elseif ($rule->fee_type === 'tiered' && is_array($rule->tiered_rates)) {
            $fee = $this->calculateTieredFee($grossAmount, $rule->tiered_rates);
        }

        // Apply minimum fee cap
        if ($rule->minimum_fee > 0 && $fee < $rule->minimum_fee) {
            $fee = $rule->minimum_fee;
        }

        // Apply maximum fee cap
        if ($rule->maximum_fee !== null && $rule->maximum_fee > 0 && $fee > $rule->maximum_fee) {
            $fee = $rule->maximum_fee;
        }

        // Fee cannot exceed gross amount
        $fee = min($fee, $grossAmount);
        $net = $grossAmount - $fee;

        return [
            'gross_amount'   => $grossAmount,
            'platform_fee'   => $fee,
            'processing_fee' => 0,
            'total_fee'      => $fee,
            'fee_amount'     => $fee,
            'net_amount'     => $net,
            'total_charged'  => $grossAmount,
            'currency'       => $currency,
            'fee_rule_id'    => $rule->id,
            'rule_code'      => $rule->code,
            'rule_name'      => $rule->name,
            'rule'           => $rule,
        ];
    }

    private function calculateTieredFee(int $grossAmount, array $tiers): int
    {
        // Tiers format: [ ['up_to' => 100000, 'percentage' => 2.0], ['up_to' => null, 'percentage' => 1.0] ]
        foreach ($tiers as $tier) {
            $upTo = $tier['up_to'] ?? null;
            $rate = (float) ($tier['percentage'] ?? 0);
            $fixed = (int) ($tier['fixed_amount'] ?? 0);

            if ($upTo === null || $grossAmount <= (int) $upTo) {
                return $fixed + (int) round(($grossAmount * $rate) / 100);
            }
        }

        return 0;
    }

    private function zeroFeePayload(int $grossAmount, string $currency): array
    {
        return [
            'gross_amount'   => $grossAmount,
            'platform_fee'   => 0,
            'processing_fee' => 0,
            'total_fee'      => 0,
            'fee_amount'     => 0,
            'net_amount'     => $grossAmount,
            'total_charged'  => $grossAmount,
            'currency'       => $currency,
            'fee_rule_id'    => null,
            'rule_code'      => null,
            'rule_name'      => null,
            'rule'           => null,
        ];
    }
}
