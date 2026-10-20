<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Earnings credited to a seller who has not completed KYC. They sit in the
        // pending bucket until the seller verifies, and then move to withdrawable.
        Schema::create('kyc_pending_earnings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('ledger_transaction_id')->nullable();
            $table->bigInteger('amount');
            $table->string('currency', 3)->default('USD');
            $table->string('source', 60);
            $table->timestamp('swept_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'swept_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kyc_pending_earnings');
    }
};
