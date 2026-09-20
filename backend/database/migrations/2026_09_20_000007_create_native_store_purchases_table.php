<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('native_store_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('coin_pack_id')->nullable()->constrained()->nullOnDelete();
            $table->string('store', 12); // apple | google
            $table->string('store_transaction_id', 191);
            $table->string('store_order_id', 191)->nullable();
            $table->string('product_id', 191);
            $table->unsignedInteger('amount_minor')->default(0);
            $table->string('currency', 3)->default('USD');
            $table->unsignedInteger('credited_coins');
            $table->string('status', 20)->default('pending'); // pending | completed | revoked
            $table->string('internal_reference', 64)->nullable()->unique();
            $table->foreignId('ledger_transaction_id')->nullable()->constrained('ledger_transactions')->nullOnDelete();
            $table->longText('payload')->nullable();
            $table->timestamps();

            $table->unique(['store', 'store_transaction_id'], 'ns_purchases_store_txn_unique');
            $table->index('store_order_id', 'ns_purchases_order_id_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('native_store_purchases');
    }
};