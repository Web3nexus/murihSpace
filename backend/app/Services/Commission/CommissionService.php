<?php

namespace App\Services\Commission;

use App\Models\AdminSetting;
use App\Models\AuditLog;
use App\Models\FeeRule;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

class CommissionService
{
    public const DEFAULT_RATES = [
        'general'  => 10.0,
        'digital'  => 10.0,
        'physical' => 5.0,
        'gifts'    => 15.0,
        'escrow'   => 5.0,
    ];

    /**
     * Get commission percentage (e.g. 10.0 for 10%).
     */
    public function getCommissionPercentage(string $type = 'general'): float
    {
        $normalizedType = strtolower(trim($type));
        $cacheKey = "platform_commission_pct:{$normalizedType}";

        return Cache::remember($cacheKey, 60, function () use ($normalizedType) {
            // 1. Check for specific active FeeRule first
            $ruleCodeMap = [
                'digital'  => 'DIGITAL_COMMERCE_FEE',
                'physical' => 'PHYSICAL_COMMERCE_FEE',
                'gifts'    => 'GIFT_FEE',
                'escrow'   => 'MARKETPLACE_ESCROW_FEE',
                'general'  => 'COMMERCE_FEE',
            ];

            $code = $ruleCodeMap[$normalizedType] ?? null;
            if ($code) {
                $rule = FeeRule::active()
                    ->where('code', $code)
                    ->whereIn('fee_type', ['percentage', 'fixed_plus_percentage'])
                    ->first();

                if ($rule && $rule->percentage > 0) {
                    return (float) $rule->percentage;
                }
            }

            // 2. Check AdminSetting
            $settingVal = AdminSetting::get("commission_percentage_{$normalizedType}");
            if ($settingVal !== null && is_numeric($settingVal)) {
                return (float) $settingVal;
            }

            // Fallback to global setting or default
            $globalVal = AdminSetting::get('commission_percentage_general');
            if ($globalVal !== null && is_numeric($globalVal)) {
                return (float) $globalVal;
            }

            return self::DEFAULT_RATES[$normalizedType] ?? self::DEFAULT_RATES['general'];
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
                    'digital'  => 'Digital Products',
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
    public function updateRates(array $newPercentages, ?User $admin = null): array
    {
        $updated = [];
        $ruleCodeMap = [
            'digital'  => ['code' => 'DIGITAL_COMMERCE_FEE', 'name' => 'Digital Product Platform Fee'],
            'physical' => ['code' => 'PHYSICAL_COMMERCE_FEE', 'name' => 'Physical Product Platform Fee'],
            'gifts'    => ['code' => 'GIFT_FEE', 'name' => 'Gift Receiving Platform Fee'],
            'escrow'   => ['code' => 'MARKETPLACE_ESCROW_FEE', 'name' => 'Marketplace Escrow Platform Fee'],
            'general'  => ['code' => 'COMMERCE_FEE', 'name' => 'General Commerce Platform Fee'],
        ];

        foreach ($newPercentages as $type => $percentage) {
            $normalizedType = strtolower(trim($type));
            if (! array_key_exists($normalizedType, self::DEFAULT_RATES)) {
                continue;
            }

            $pct = max(0.0, min(100.0, (float) $percentage));
            AdminSetting::set("commission_percentage_{$normalizedType}", $pct);
            Cache::forget("platform_commission_pct:{$normalizedType}");

            // Keep FeeRule table synchronized
            if (isset($ruleCodeMap[$normalizedType])) {
                $meta = $ruleCodeMap[$normalizedType];
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
                'ip_address'    => request()->ip(),
                'user_agent'    => request()->userAgent(),
            ]);
        }

        return $this->getAllRates();
    }
}
