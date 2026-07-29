<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('fulfilment_order_id')->constrained('fulfilment_orders')->cascadeOnDelete();
            $table->string('product_name');
            $table->string('reason');
            $table->string('status')->default('pending'); // pending, approved, rejected, completed
            $table->text('admin_note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_returns');
    }
};
