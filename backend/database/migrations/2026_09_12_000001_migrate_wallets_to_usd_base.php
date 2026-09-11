<?php

use App\Models\CurrencyExchangeRate;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Change default currency on wallets table to USD
        Schema::table('wallets', function (Blueprint $table) {
            $table->string('currency', 3)->default('USD')->change();
        });

        // 2. Fetch current NGN -> USD rate
        $ngnToUsdRate = CurrencyExchangeRate::where('from_currency', 'NGN')
            ->where('to_currency', 'USD')
            ->value('rate');

        $rate = $ngnToUsdRate ? (float) $ngnToUsdRate : (1.0 / 1500.0);

        // 3. Migrate any existing NGN wallets: convert kobo to USD cents
        // available = (available * rate)
        $ngnWallets = DB::table('wallets')->where('currency', 'NGN')->get();

        foreach ($ngnWallets as $w) {
            DB::table('wallets')->where('id', $w->id)->update([
                'currency'         => 'USD',
                'available'        => (int) round($w->available * $rate),
                'pending'          => (int) round($w->pending * $rate),
                'reserved'         => (int) round($w->reserved * $rate),
                'escrow'           => (int) round($w->escrow * $rate),
                'withdrawable'     => (int) round($w->withdrawable * $rate),
                'non_withdrawable' => (int) round($w->non_withdrawable * $rate),
                'disputed'         => (int) round($w->disputed * $rate),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('wallets', function (Blueprint $table) {
            $table->string('currency', 3)->default('NGN')->change();
        });
    }
};
