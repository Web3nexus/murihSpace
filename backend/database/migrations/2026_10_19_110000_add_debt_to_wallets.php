<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Amount a wallet owes after a clawback it could not cover (minor units).
        // Earnings repay it first, and withdrawals stay locked while it is above zero.
        Schema::table('wallets', function (Blueprint $table) {
            $table->bigInteger('debt')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('wallets', function (Blueprint $table) {
            $table->dropColumn('debt');
        });
    }
};
