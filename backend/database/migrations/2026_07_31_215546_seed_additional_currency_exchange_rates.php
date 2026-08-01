<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $rates = [
            // Ghana (USD anchor)
            ['GHS', 'USD', 0.0730],
            ['USD', 'GHS', 13.7000],
            ['NGN', 'GHS', 0.009133],
            ['GHS', 'NGN', 109.5000],
            // Kenya (USD anchor)
            ['KES', 'USD', 0.0077],
            ['USD', 'KES', 129.5000],
            ['NGN', 'KES', 0.011556],
            ['KES', 'NGN', 86.5600],
            // South Africa (USD anchor)
            ['ZAR', 'USD', 0.0546],
            ['USD', 'ZAR', 18.3200],
            ['NGN', 'ZAR', 0.081867],
            ['ZAR', 'NGN', 12.2133],
            // West Africa XOF (pegged to EUR)
            ['XOF', 'USD', 0.001641],
            ['USD', 'XOF', 609.4000],
            ['NGN', 'XOF', 0.406267],
            ['XOF', 'NGN', 2.4614],
            // Cross pairs
            ['GBP', 'GHS', 17.3418],
            ['GHS', 'GBP', 0.0577],
            ['GBP', 'KES', 163.9582],
            ['KES', 'GBP', 0.0061],
            ['GBP', 'ZAR', 23.2036],
            ['ZAR', 'GBP', 0.0431],
            ['GBP', 'XOF', 771.7475],
            ['XOF', 'GBP', 0.0013],
            ['EUR', 'GHS', 14.8435],
            ['GHS', 'EUR', 0.0674],
            ['EUR', 'KES', 140.3478],
            ['KES', 'EUR', 0.0071],
            ['EUR', 'ZAR', 19.8520],
            ['ZAR', 'EUR', 0.0504],
            ['EUR', 'XOF', 660.3500],
            ['XOF', 'EUR', 0.001514],
        ];

        foreach ($rates as [$from, $to, $rate]) {
            DB::table('currency_exchange_rates')->updateOrInsert(
                ['from_currency' => $from, 'to_currency' => $to],
                ['rate' => $rate, 'updated_at' => now()],
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $codes = ['GHS', 'KES', 'ZAR', 'XOF'];
        DB::table('currency_exchange_rates')
            ->whereIn('from_currency', $codes)
            ->orWhereIn('to_currency', $codes)
            ->delete();
    }
};
