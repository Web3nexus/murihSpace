<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ledger_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('wallet_type', 20)->default('system'); // system|creator|business|platform
            $table->string('code', 50)->unique();                 // e.g. USER-1-SYSTEM
            $table->string('name', 100);
            $table->string('account_type', 20);                  // asset|liability|revenue|expense
            $table->string('currency', 3)->default('NGN');
            $table->boolean('is_system')->default(false);         // platform-level accounts
            $table->timestamps();

            $table->index(['user_id', 'wallet_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_accounts');
    }
};
