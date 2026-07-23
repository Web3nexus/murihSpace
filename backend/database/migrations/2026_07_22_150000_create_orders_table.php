<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique(); // e.g. ORD-20260722-A1B2
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('digital_products')->cascadeOnDelete();
            $table->decimal('subtotal', 10, 2);
            $table->decimal('platform_fee', 10, 2)->default(0.00);
            $table->decimal('total', 10, 2);
            $table->string('currency', 3)->default('USD');
            // pending → processing → completed | failed | refunded
            $table->string('status')->default('pending');
            $table->string('payment_provider')->default('mock'); // 'stripe', 'paypal', 'mock'
            $table->string('payment_intent_id')->nullable();
            $table->string('idempotency_key')->unique(); // prevents duplicate order creation
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['buyer_id', 'status']);
            $table->index(['creator_id', 'status']);
            $table->index('idempotency_key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
