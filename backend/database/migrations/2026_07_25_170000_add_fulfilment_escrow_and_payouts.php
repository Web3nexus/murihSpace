<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('escrows', function (Blueprint $table) {
            $table->foreignId('fulfilment_order_id')->nullable()->constrained()->cascadeOnDelete();
        });

        Schema::create('fulfilment_payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('fulfilment_order_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('gross_amount');
            $table->unsignedBigInteger('platform_fee');
            $table->unsignedBigInteger('net_amount');
            $table->string('currency', 3)->default('NGN');
            $table->string('status')->default('pending');
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->unique('fulfilment_order_id');
            $table->index(['creator_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fulfilment_payouts');
        Schema::table('escrows', function (Blueprint $table) {
            $table->dropForeign(['fulfilment_order_id']);
            $table->dropColumn('fulfilment_order_id');
        });
    }
};
