<?php

use App\Services\Payment\LiveExchangeRateService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Updated market baseline rates replacing the obsolete 1500 seed
        $baseline = [
            'NGN' => 1327.241555,
            'KES' => 129.679115,
            'GHS' => 11.701151,
            'ZAR' => 16.406940,
            'EUR' => 0.881520,
            'GBP' => 0.755961,
            'CAD' => 1.418513,
            'AUD' => 1.430842,
            'UGX' => 3830.605782,
            'TZS' => 2615.169812,
            'RWF' => 1476.645220,
            'XOF' => 578.234411,
            'USD' => 1.000000,
        ];

        foreach ($baseline as $code => $rate) {
            DB::table('currency_exchange_rates')->updateOrInsert(
                ['from_currency' => 'USD', 'to_currency' => $code],
                ['rate' => $rate, 'updated_at' => now()]
            );

            if ($code !== 'USD' && $rate > 0) {
                DB::table('currency_exchange_rates')->updateOrInsert(
                    ['from_currency' => $code, 'to_currency' => 'USD'],
                    ['rate' => round(1.0 / $rate, 8), 'updated_at' => now()]
                );
            }
        }

        // 2. Attempt real-time API sync if internet connectivity is available
        try {
            app(LiveExchangeRateService::class)->syncRates();
        } catch (\Throwable) {
            // Baseline inserted above serves as a reliable updated foundation
        }
    }

    public function down(): void
    {
        // No-op
    }
};
