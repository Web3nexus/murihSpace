<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private function rules(): array
    {
        return [
            [
                'name'             => 'Airwallex Card Deposit Fee (USD)',
                'code'             => 'DEPOSIT_AIRWALLEX_USD',
                'description'      => 'Fee applied on international card top-ups in USD via Airwallex',
                'fee_type'         => 'fixed_plus_percentage',
                'fixed_amount'     => 30,   // $0.30
                'percentage'       => 2.9,
                'minimum_fee'      => 0,
                'maximum_fee'      => null,
                'currency'         => 'USD',
                'country'          => '*',
                'transaction_type' => 'deposit',
                'wallet_type'      => 'system',
                'payment_method'   => 'airwallex',
                'enabled'          => true,
                'priority'         => 10,
            ],
            [
                'name'             => 'Airwallex Card Deposit Fee (EUR)',
                'code'             => 'DEPOSIT_AIRWALLEX_EUR',
                'description'      => 'Fee applied on international card top-ups in EUR via Airwallex',
                'fee_type'         => 'fixed_plus_percentage',
                'fixed_amount'     => 30,   // €0.30
                'percentage'       => 2.9,
                'minimum_fee'      => 0,
                'maximum_fee'      => null,
                'currency'         => 'EUR',
                'country'          => '*',
                'transaction_type' => 'deposit',
                'wallet_type'      => 'system',
                'payment_method'   => 'airwallex',
                'enabled'          => true,
                'priority'         => 10,
            ],
            [
                'name'             => 'Airwallex Card Deposit Fee (GBP)',
                'code'             => 'DEPOSIT_AIRWALLEX_GBP',
                'description'      => 'Fee applied on international card top-ups in GBP via Airwallex',
                'fee_type'         => 'fixed_plus_percentage',
                'fixed_amount'     => 30,   // £0.30
                'percentage'       => 2.9,
                'minimum_fee'      => 0,
                'maximum_fee'      => null,
                'currency'         => 'GBP',
                'country'          => '*',
                'transaction_type' => 'deposit',
                'wallet_type'      => 'system',
                'payment_method'   => 'airwallex',
                'enabled'          => true,
                'priority'         => 10,
            ],
            [
                'name'             => 'Airwallex Bank Transfer Deposit Fee (USD)',
                'code'             => 'DEPOSIT_AIRWALLEX_BANK_USD',
                'description'      => 'Fee applied on international bank-transfer top-ups in USD via Airwallex',
                'fee_type'         => 'percentage',
                'fixed_amount'     => 0,
                'percentage'       => 1.0,
                'minimum_fee'      => 100,  // $1.00
                'maximum_fee'      => null,
                'currency'         => 'USD',
                'country'          => '*',
                'transaction_type' => 'deposit',
                'wallet_type'      => 'system',
                'payment_method'   => 'airwallex',
                'enabled'          => true,
                'priority'         => 10,
            ],
            [
                'name'             => 'Airwallex Payout Fee (USD)',
                'code'             => 'PAYOUT_AIRWALLEX_USD',
                'description'      => 'Fee applied on creator payouts in USD via Airwallex',
                'fee_type'         => 'percentage',
                'fixed_amount'     => 0,
                'percentage'       => 1.0,
                'minimum_fee'      => 250,  // $2.50
                'maximum_fee'      => 5000, // $50.00
                'currency'         => 'USD',
                'country'          => '*',
                'transaction_type' => 'payout',
                'wallet_type'      => 'creator',
                'payment_method'   => 'airwallex',
                'enabled'          => true,
                'priority'         => 10,
            ],
            [
                'name'             => 'Airwallex Payout Fee (EUR)',
                'code'             => 'PAYOUT_AIRWALLEX_EUR',
                'description'      => 'Fee applied on creator payouts in EUR via Airwallex',
                'fee_type'         => 'percentage',
                'fixed_amount'     => 0,
                'percentage'       => 1.0,
                'minimum_fee'      => 200,  // €2.00
                'maximum_fee'      => 5000, // €50.00
                'currency'         => 'EUR',
                'country'          => '*',
                'transaction_type' => 'payout',
                'wallet_type'      => 'creator',
                'payment_method'   => 'airwallex',
                'enabled'          => true,
                'priority'         => 10,
            ],
            [
                'name'             => 'Airwallex Payout Fee (GBP)',
                'code'             => 'PAYOUT_AIRWALLEX_GBP',
                'description'      => 'Fee applied on creator payouts in GBP via Airwallex',
                'fee_type'         => 'percentage',
                'fixed_amount'     => 0,
                'percentage'       => 1.0,
                'minimum_fee'      => 200,  // £2.00
                'maximum_fee'      => 4000, // £40.00
                'currency'         => 'GBP',
                'country'          => '*',
                'transaction_type' => 'payout',
                'wallet_type'      => 'creator',
                'payment_method'   => 'airwallex',
                'enabled'          => true,
                'priority'         => 10,
            ],
        ];
    }

    public function up(): void
    {
        foreach ($this->rules() as $rule) {
            DB::table('fee_rules')->updateOrInsert(
                ['code' => $rule['code']],
                array_merge($rule, ['created_at' => now(), 'updated_at' => now()])
            );
        }
    }

    public function down(): void
    {
        DB::table('fee_rules')->whereIn('code', collect($this->rules())->pluck('code'))->delete();
    }
};