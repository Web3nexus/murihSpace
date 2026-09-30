<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Normalise platform fee rules to the USD base currency.
 *
 * Legacy fee rules were seeded in Naira (minor units = kobo). Since wallets and
 * all platform money now default to USD minor units (cents), existing NGN rules
 * are automatically converted to their USD-cent equivalents using the platform's
 * stored USD/NGN exchange rate. Percentage rates are currency-agnostic and stay
 * unchanged. New rules are created in USD by the admin fee endpoints.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('fee_rules')) {
            return;
        }

        // Live rate fallback mirrors LiveExchangeRateService's fallback seed (USD 1 = ₦1,550).
        $ngnPerUsd = (float) DB::table('currency_exchange_rates')
            ->where('from_currency', 'USD')
            ->where('to_currency', 'NGN')
            ->value('rate') ?? 1550.0;
        $ngnPerUsd = max(1.0, (float) $ngnPerUsd);

        DB::table('fee_rules')
            ->where('currency', 'NGN')
            ->orderBy('id')
            ->chunkById(200, function ($rules) use ($ngnPerUsd) {
                foreach ($rules as $rule) {
                    $updates = ['currency' => 'USD'];
                    foreach (['fixed_amount', 'minimum_fee', 'maximum_fee'] as $column) {
                        $value = (int) ($rule->{$column} ?? 0);
                        if ($value > 0) {
                            $updates[$column] = (int) round($value / $ngnPerUsd);
                        }
                    }
                    DB::table('fee_rules')->where('id', $rule->id)->update($updates);
                }
            });
    }

    public function down(): void
    {
        if (! Schema::hasTable('fee_rules')) {
            return;
        }

        $ngnPerUsd = (float) DB::table('currency_exchange_rates')
            ->where('from_currency', 'USD')
            ->where('to_currency', 'NGN')
            ->value('rate') ?? 1550.0;
        $ngnPerUsd = max(1.0, (float) $ngnPerUsd);

        DB::table('fee_rules')
            ->where('currency', 'USD')
            ->whereIn('code', ['DEPOSIT_PAYSTACK', 'DEPOSIT_FLUTTERWAVE', 'INTERNAL_TRANSFER', 'WITHDRAWAL', 'GIFT_RECEIVING'])
            ->orderBy('id')
            ->chunkById(200, function ($rules) use ($ngnPerUsd) {
                foreach ($rules as $rule) {
                    $updates = ['currency' => 'NGN'];
                    foreach (['fixed_amount', 'minimum_fee', 'maximum_fee'] as $column) {
                        $value = (int) ($rule->{$column} ?? 0);
                        if ($value > 0) {
                            $updates[$column] = (int) round($value * $ngnPerUsd);
                        }
                    }
                    DB::table('fee_rules')->where('id', $rule->id)->update($updates);
                }
            });
    }
};