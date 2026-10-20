<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The transaction fee charged when a coin pack is bought (minor units). It is separate from
        // the receiver's gift commission, and is shown on the purchase.
        Schema::table('coin_purchases', function (Blueprint $table) {
            $table->bigInteger('transaction_fee')->default(0)->after('total_charged');
        });
    }

    public function down(): void
    {
        Schema::table('coin_purchases', function (Blueprint $table) {
            $table->dropColumn('transaction_fee');
        });
    }
};
