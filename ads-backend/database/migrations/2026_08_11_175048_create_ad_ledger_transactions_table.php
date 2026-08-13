<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ad_ledger_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ad_wallet_id')->constrained('ad_wallets')->onDelete('cascade');
            $table->bigInteger('amount'); // Minor units, positive or negative
            $table->string('type'); // credit, debit, reserve, release
            $table->string('reference_type')->nullable(); // e.g., 'campaign', 'deposit'
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('description')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ad_ledger_transactions');
    }
};
