<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->unsignedBigInteger('base_rate');
            $table->unsignedBigInteger('per_item_rate')->default(0);
            $table->unsignedSmallInteger('estimated_days_min')->default(3);
            $table->unsignedSmallInteger('estimated_days_max')->default(7);
            $table->json('countries')->nullable();
            $table->string('currency', 3)->default('NGN');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['creator_id', 'is_active']);
        });

        Schema::create('tracking_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fulfilment_order_id')->constrained()->cascadeOnDelete();
            $table->string('event');
            $table->string('location')->nullable();
            $table->text('description')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['fulfilment_order_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracking_events');
        Schema::dropIfExists('shipping_profiles');
    }
};
