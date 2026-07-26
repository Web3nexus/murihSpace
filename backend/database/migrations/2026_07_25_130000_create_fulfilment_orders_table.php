<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fulfilment_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('shipping_address_id')->nullable()->constrained('addresses')->nullOnDelete();
            $table->string('order_number')->unique();
            $table->unsignedBigInteger('subtotal')->default(0);
            $table->unsignedBigInteger('shipping_cost')->default(0);
            $table->unsignedBigInteger('platform_fee')->default(0);
            $table->unsignedBigInteger('total')->default(0);
            $table->string('currency', 3)->default('NGN');
            $table->string('status')->default('pending');
            $table->string('tracking_number')->nullable();
            $table->string('carrier')->nullable();
            $table->date('estimated_delivery')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['buyer_id', 'status']);
            $table->index('order_number');
        });

        Schema::create('fulfilment_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fulfilment_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('physical_product_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->unsignedBigInteger('unit_price');
            $table->string('currency', 3)->default('NGN');
            $table->timestamps();

            $table->index('fulfilment_order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fulfilment_order_items');
        Schema::dropIfExists('fulfilment_orders');
    }
};
