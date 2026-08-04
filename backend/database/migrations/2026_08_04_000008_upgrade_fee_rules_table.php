<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fee_rules', function (Blueprint $table) {
            $table->string('description')->nullable()->after('name');
            $table->string('country', 10)->nullable()->after('currency');
            $table->string('role', 30)->nullable()->after('country');
            $table->string('payment_method', 50)->nullable()->after('transaction_type');
            $table->json('tiered_rates')->nullable()->after('payment_method');
            $table->timestamp('effective_from')->nullable()->after('enabled');
            $table->timestamp('effective_until')->nullable()->after('effective_from');
            $table->integer('priority')->default(0)->after('effective_until');
        });

        // Seed default platform fee rules
        $defaultRules = [
            [
                'name'             => 'Paystack Deposit Fee',
                'code'             => 'DEPOSIT_PAYSTACK',
                'description'      => 'Fee applied on cash deposits via Paystack gateway',
                'fee_type'         => 'percentage',
                'fixed_amount'     => 0,
                'percentage'       => 1.50,
                'minimum_fee'      => 0,
                'maximum_fee'      => 200000, // max ₦2,000.00
                'currency'         => 'NGN',
                'transaction_type' => 'deposit',
                'wallet_type'      => 'system',
                'payment_method'   => 'paystack',
                'enabled'          => true,
                'priority'         => 10,
                'created_at'       => now(),
                'updated_at'       => now(),
            ],
            [
                'name'             => 'Flutterwave Deposit Fee',
                'code'             => 'DEPOSIT_FLUTTERWAVE',
                'description'      => 'Fee applied on cash deposits via Flutterwave gateway',
                'fee_type'         => 'percentage',
                'fixed_amount'     => 0,
                'percentage'       => 1.40,
                'minimum_fee'      => 0,
                'maximum_fee'      => 200000,
                'currency'         => 'NGN',
                'transaction_type' => 'deposit',
                'wallet_type'      => 'system',
                'payment_method'   => 'flutterwave',
                'enabled'          => true,
                'priority'         => 10,
                'created_at'       => now(),
                'updated_at'       => now(),
            ],
            [
                'name'             => 'Internal Wallet Transfer Fee',
                'code'             => 'INTERNAL_TRANSFER',
                'description'      => 'Platform fee when transferring from Creator/Business wallet to System wallet',
                'fee_type'         => 'percentage',
                'fixed_amount'     => 0,
                'percentage'       => 1.00,
                'minimum_fee'      => 5000, // min ₦50.00
                'maximum_fee'      => null,
                'currency'         => 'NGN',
                'transaction_type' => 'internal_transfer',
                'wallet_type'      => 'system',
                'enabled'          => true,
                'priority'         => 10,
                'created_at'       => now(),
                'updated_at'       => now(),
            ],
            [
                'name'             => 'Withdrawal Processing Fee',
                'code'             => 'WITHDRAWAL',
                'description'      => 'Bank payout processing fee for withdrawals',
                'fee_type'         => 'fixed',
                'fixed_amount'     => 5000, // ₦50.00
                'percentage'       => 0.00,
                'minimum_fee'      => 5000,
                'maximum_fee'      => 5000,
                'currency'         => 'NGN',
                'transaction_type' => 'withdrawal',
                'enabled'          => true,
                'priority'         => 10,
                'created_at'       => now(),
                'updated_at'       => now(),
            ],
            [
                'name'             => 'Creator Gift Receiving Fee',
                'code'             => 'GIFT_RECEIVING',
                'description'      => 'Platform commission retained on creator gifts received',
                'fee_type'         => 'percentage',
                'fixed_amount'     => 0,
                'percentage'       => 10.00, // 10% platform commission
                'minimum_fee'      => 0,
                'maximum_fee'      => null,
                'currency'         => 'NGN',
                'transaction_type' => 'creator_gift_receipt',
                'wallet_type'      => 'creator',
                'enabled'          => true,
                'priority'         => 10,
                'created_at'       => now(),
                'updated_at'       => now(),
            ],
        ];

        foreach ($defaultRules as $rule) {
            DB::table('fee_rules')->updateOrInsert(['code' => $rule['code']], $rule);
        }
    }

    public function down(): void
    {
        Schema::table('fee_rules', function (Blueprint $table) {
            $table->dropColumn([
                'description', 'country', 'role', 'payment_method',
                'tiered_rates', 'effective_from', 'effective_until', 'priority',
            ]);
        });
    }
};
