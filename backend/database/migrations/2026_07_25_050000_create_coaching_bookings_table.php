<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coaching_bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_id')->constrained('coaching_services')->cascadeOnDelete();
            $table->foreignId('slot_id')->nullable()->constrained('coaching_slots')->nullOnDelete();
            $table->foreignId('booker_id')->constrained('users')->cascadeOnDelete();
            $table->dateTime('start_time');
            $table->dateTime('end_time');
            $table->string('status')->default('confirmed');
            $table->text('notes')->nullable();
            $table->string('meeting_url')->nullable();
            $table->integer('price_paid')->default(0);
            $table->string('currency', 3)->default('NGN');
            $table->timestamps();

            $table->index(['service_id', 'start_time']);
            $table->index(['booker_id', 'status']);
            $table->index(['slot_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coaching_bookings');
    }
};
