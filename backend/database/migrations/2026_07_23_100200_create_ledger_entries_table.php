<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ledger_transaction_id')->constrained()->cascadeOnDelete();
            $table->string('account_type');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('entry_type');
            $table->bigInteger('amount');
            $table->string('currency', 3)->default('NGN');
            $table->bigInteger('balance_before')->default(0);
            $table->bigInteger('balance_after')->default(0);
            $table->timestamps();

            $table->index(['account_type', 'user_id']);
            $table->index('ledger_transaction_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
    }
};
