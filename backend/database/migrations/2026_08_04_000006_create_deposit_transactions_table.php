<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deposit_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('wallet_type', 20)->default('system');
            $table->string('idempotency_key', 100)->unique();
            $table->string('payment_gateway', 50)->default('paystack');
            $table->string('gateway_reference', 100)->unique();
            $table->bigInteger('amount');
            $table->bigInteger('fee_amount')->default(0);
            $table->bigInteger('net_amount');
            $table->string('currency', 3)->default('NGN');
            $table->string('status', 20)->default('pending'); // pending|completed|failed
            $table->foreignId('ledger_transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('wallet_credited_at')->nullable();
            $table->json('gateway_payload')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deposit_transactions');
    }
};
