<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fee_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('code', 50)->unique();              // e.g. DEPOSIT_PAYSTACK, INTERNAL_TRANSFER
            $table->string('fee_type', 30)->default('percentage'); // fixed|percentage|fixed_plus_percentage
            $table->bigInteger('fixed_amount')->default(0);    // minor units
            $table->decimal('percentage', 5, 2)->default(0.00); // e.g. 1.50 %
            $table->bigInteger('minimum_fee')->default(0);
            $table->bigInteger('maximum_fee')->nullable();
            $table->string('currency', 3)->default('NGN');
            $table->string('transaction_type', 50)->nullable();
            $table->string('wallet_type', 20)->nullable();
            $table->boolean('enabled')->default(true);
            $table->timestamps();
        });

        Schema::create('fee_calculations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fee_rule_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('ledger_transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->bigInteger('gross_amount');
            $table->bigInteger('fee_amount');
            $table->bigInteger('net_amount');
            $table->string('currency', 3)->default('NGN');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fee_calculations');
        Schema::dropIfExists('fee_rules');
    }
};
