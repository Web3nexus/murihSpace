<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per paid digital order. The seller's share is held for 48 hours, in USD
        // minor units, and then released unless a dispute or chargeback is open.
        Schema::create('digital_sale_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->string('order_currency', 3);
            $table->decimal('order_net_amount', 14, 2);
            $table->decimal('fx_rate', 18, 8)->default(1);
            $table->bigInteger('gross_usd');          // seller share in USD cents, before debt repayment
            $table->bigInteger('credited_usd');       // what reached the seller after any debt repayment
            $table->bigInteger('held_usd')->default(0); // amount moved to `disputed` after release
            $table->string('status', 20)->default('pending')->index(); // pending | released | disputed | reversed
            $table->timestamp('release_at')->index();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('disputed_at')->nullable();
            $table->string('dispute_source', 20)->nullable(); // buyer | chargeback
            $table->string('dispute_outcome', 20)->nullable(); // seller_won | buyer_won
            $table->boolean('provider_refund_required')->default(false);
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('digital_sale_settlements');
    }
};
