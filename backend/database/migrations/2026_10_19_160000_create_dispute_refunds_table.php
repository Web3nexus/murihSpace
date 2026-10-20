<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A buyer's refund after a dispute they won. The money is credited to their balance on the
        // platform, where it can be spent on purchases or gifts but not withdrawn. The buyer can send
        // it back to the original card, which triggers the provider refund.
        Schema::create('dispute_refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('order_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('settlement_id')->nullable()->constrained('digital_sale_settlements')->nullOnDelete();
            $table->decimal('original_amount', 14, 2);   // the amount charged to the card, in its currency
            $table->string('original_currency', 3);
            $table->bigInteger('amount_usd');            // the balance credited, in USD cents
            $table->string('status', 20)->default('available')->index(); // available | refunded_to_card | failed
            $table->string('provider_refund_id')->nullable();
            $table->string('failure_reason')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispute_refunds');
    }
};
