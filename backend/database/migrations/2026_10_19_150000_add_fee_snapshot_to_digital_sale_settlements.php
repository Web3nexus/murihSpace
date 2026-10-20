<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The fees applied to this sale, frozen when it is settled, so every transaction
        // shows the rate that was in force at the time, even after an admin change.
        Schema::table('digital_sale_settlements', function (Blueprint $table) {
            $table->decimal('seller_fee_rate', 8, 4)->default(0)->after('fx_rate');
            $table->bigInteger('seller_fee_usd')->default(0)->after('seller_fee_rate');
            $table->bigInteger('buyer_fee_usd')->default(0)->after('seller_fee_usd');
        });
    }

    public function down(): void
    {
        Schema::table('digital_sale_settlements', function (Blueprint $table) {
            $table->dropColumn(['seller_fee_rate', 'seller_fee_usd', 'buyer_fee_usd']);
        });
    }
};
