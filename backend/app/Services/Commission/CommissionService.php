<?php

namespace App\Services\Commission;

use App\Models\AdminSetting;
use App\Models\AuditLog;
use App\Models\FeeRule;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

class CommissionService
{
    /**
     * The one fee schedule. `digital` is the seller's share of a digital sale and
     * `digital_buyer` is the flat buyer fee added at checkout. Fees carry no VAT.
     * Admin edits write `commission_percentage_{type}`; that setting is the only source.
     */
    public const DEFAULT_RATES = [
        'general'  => 10.0,
        'digital'  => 20.0,
        'digital_buyer' => 5.0,
        // Charged to the buyer when a coin pack is bought. The gift commission ('gifts') is taken from the receiver's gift.
        'coin_purchase' => 5.0,
        'physical' => 5.0,
        'gifts'    => 30.0,
        // Escrow is a protection, not a charge: both parties already pay their fees, so no escrow fee is taken.
        'escrow'   => 0.0,
    ];

    /**
     * The fee rule code that mirrors each commission type. A FeeRule carrying one of these
     * codes is an editor for the matching `commission_percentage_{type}` setting, not a
     * second source of truth.
     */
    public const RULE_CODE_MAP = [
        'digital'  => ['code' => 'DIGITAL_COMMERCE_FEE', 'name' => 'Digital Product Seller Fee'],
        'digital_buyer' => ['code' => 'DIGITAL_BUYER_FEE', 'name' => 'Digital Product Buyer Fee'],
        'coin_purchase' => ['code' => 'COIN_PURCHASE_FEE', 'name' => 'Coin Pack Transaction Fee'],
        'physical' => ['code' => 'PHYSICAL_COMMERCE_FEE', 'name' => 'Physical Product Platform Fee'],
        'gifts'    => ['code' => 'GIFT_FEE', 'name' => 'Gift Receiving Platform Fee'],
        'escrow'   => ['code' => 'MARKETPLACE_ESCROW_FEE', 'name' => 'Marketplace Escrow Platform Fee'],
        'general'  => ['code' => 'COMMERCE_FEE', 'name' => 'General Commerce Platform Fee'],
    ];

    /**
     * The commission type a fee rule code controls, or null when the rule is not a commission rule.
     */
    public static function commissionTypeForRuleCode(?string $code): ?string
    {
        $normalized = strtoupper(trim((string) $code));
        if ($normalized === '') {
            return null;
        }

        foreach (self::RULE_CODE_MAP as $type => $meta) {
            if ($meta['code'] === $normalized) {
                return $type;
            }
        }

        return null;
    }

    /**
     * Write a commission FeeRule's percentage into the setting CommissionService reads.
     * Call inside the caller's transaction, after the rule is saved. Returns the commission
     * type written, or null when the rule is not a commission rule. Call forgetCachedRate()
     * once the transaction has committed.
     */
    public function setRateFromFeeRule(FeeRule $rule, ?User $admin = null, ?string $ipAddress = null, ?string $userAgent = null): ?string
    {
        $type = self::commissionTypeForRuleCode($rule->code);
        if ($type === null) {
            return null;
        }

        $pct = max(0.0, min(100.0, (float) $rule->percentage));
        $key = "commission_percentage_{$type}";
        $previous = AdminSetting::get($key);

        AdminSetting::set($key, $pct);

        if ($admin) {
            AuditLog::create([
                'user_id'       => $admin->id,
                'action'        => 'commission.updated',
                'resource_type' => 'fee_rule',
                'resource_id'   => (string) $rule->id,
                'metadata'      => [
                    'source'          => 'fee_rule',
                    'rule_code'       => $rule->code,
                    'commission_type' => $type,
                    'previous_percentage' => $previous !== null && is_numeric($previous) ? (float) $previous : null,
                    'new_percentage'  => $pct,
                    'admin_role'        => $admin->admin_role ?? 'super_admin',
                    'admin_permissions' => $admin->admin_permissions ?? ['fees', 'settings'],
                ],
                'ip_address'    => $ipAddress,
                'user_agent'    => $userAgent,
            ]);
        }

        return $type;
    }

    public function forgetCachedRate(string $type): void
    {
        Cache::forget('platform_commission_pct:'.strtolower(trim($type)));
    }

    /**
     * Get commission percentage (e.g. 10.0 for 10%).
     */
    public function getCommissionPercentage(string $type = 'general'): float
    {
        $normalizedType = strtolower(trim($type));
        $cacheKey = "platform_commission_pct:{$normalizedType}";

        return Cache::remember($cacheKey, 60, function () use ($normalizedType) {
            // The admin setting is the single source of truth. FeeRule rows only mirror it.
            $settingVal = AdminSetting::get("commission_percentage_{$normalizedType}");
            if ($settingVal !== null && is_numeric($settingVal)) {
                return (float) $settingVal;
            }

            // A known type always takes its schedule rate. The general setting only applies to unknown types,
            // so one saved general rate cannot override the per-type fees.
            if (array_key_exists($normalizedType, self::DEFAULT_RATES)) {
                return self::DEFAULT_RATES[$normalizedType];
            }

            $globalVal = AdminSetting::get('commission_percentage_general');
            if ($globalVal !== null && is_numeric($globalVal)) {
                return (float) $globalVal;
            }

            return self::DEFAULT_RATES['general'];
        });
    }

    /**
     * Get commission rate as decimal factor (e.g. 0.10 for 10%).
     */
    public function getCommissionRate(string $type = 'general'): float
    {
        return round($this->getCommissionPercentage($type) / 100, 4);
    }

    /**
     * Splits a gift's coin price between the receiver and the platform. The sender pays exactly
     * the coin price. The platform's gift commission is taken from the receiver's share.
     *
     * @return array{platform_commission: int, creator_earns: int, rate: float}
     */
    public function splitGift(int $grossCoins): array
    {
        $rate = $this->getCommissionPercentage('gifts');
        $commission = (int) round($grossCoins * $rate / 100);

        return [
            'platform_commission' => $commission,
            'creator_earns' => max(0, $grossCoins - $commission),
            'rate' => $rate,
        ];
    }

    /**
     * Calculate commission fee for a given gross amount.
     */
    public function calculateFee(float|int $grossAmount, string $type = 'general'): float
    {
        if ($grossAmount <= 0) {
            return 0.0;
        }

        $rate = $this->getCommissionRate($type);
        return round(((float) $grossAmount) * $rate, 2);
    }

    /**
     * Get all configured commission rates.
     */
    public function getAllRates(): array
    {
        $rates = [];
        foreach (self::DEFAULT_RATES as $type => $default) {
            $rates[$type] = [
                'type'        => $type,
                'name'        => match ($type) {
                    'digital'  => 'Digital Products (seller)',
                    'digital_buyer' => 'Digital Products (buyer)',
                    'physical' => 'Physical Goods',
                    'gifts'    => 'Livestream & Chat Gifts',
                    'escrow'   => 'Marketplace Escrow',
                    default    => 'General Commerce',
                },
                'percentage'  => $this->getCommissionPercentage($type),
                'decimal_rate'=> $this->getCommissionRate($type),
                'default'     => $default,
            ];
        }

        return $rates;
    }

    /**
     * Update commission rates (Admin only).
     */
    public function updateRates(array $newPercentages, ?User $admin = null, ?string $ipAddress = null, ?string $userAgent = null): array
    {
        $updated = [];
        foreach ($newPercentages as $type => $percentage) {
            $normalizedType = strtolower(trim($type));
            if (! array_key_exists($normalizedType, self::DEFAULT_RATES)) {
                continue;
            }

            $pct = max(0.0, min(100.0, (float) $percentage));
            AdminSetting::set("commission_percentage_{$normalizedType}", $pct);
            Cache::forget("platform_commission_pct:{$normalizedType}");

            // Keep FeeRule table synchronized
            if (isset(self::RULE_CODE_MAP[$normalizedType])) {
                $meta = self::RULE_CODE_MAP[$normalizedType];
                FeeRule::updateOrCreate(
                    ['code' => $meta['code']],
                    [
                        'name'             => $meta['name'],
                        'fee_type'         => 'percentage',
                        'percentage'       => $pct,
                        'fixed_amount'     => 0,
                        'minimum_fee'      => 0,
                        'currency'         => 'USD',
                        'transaction_type' => $normalizedType,
                        'enabled'          => true,
                        'priority'         => 10,
                    ]
                );
            }

            $updated[$normalizedType] = $pct;
        }

        if ($admin) {
            AuditLog::create([
                'user_id'       => $admin->id,
                'action'        => 'commission.updated',
                'resource_type' => 'platform_settings',
                'resource_id'   => 'commission_rates',
                'metadata'      => [
                    'updated_rates'     => $updated,
                    'admin_role'        => $admin->admin_role ?? 'super_admin',
                    'admin_permissions' => $admin->admin_permissions ?? ['fees', 'settings'],
                ],
                'ip_address'    => $ipAddress,
                'user_agent'    => $userAgent,
            ]);
        }

        return $this->getAllRates();
    }
}
