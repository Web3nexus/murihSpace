<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wallet_holds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('wallet_id')->constrained()->cascadeOnDelete();
            $table->string('wallet_type', 20)->default('system');
            $table->bigInteger('amount');
            $table->string('currency', 3)->default('NGN');
            $table->string('balance_category', 30)->default('available'); // available|pending|reserved|escrow
            $table->string('reason', 100);
            $table->string('reference_type', 50)->nullable();             // order|dispute|tax_hold
            $table->string('reference_id', 50)->nullable();
            $table->string('status', 20)->default('active');               // active|released|consumed|expired
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'wallet_type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallet_holds');
    }
};
