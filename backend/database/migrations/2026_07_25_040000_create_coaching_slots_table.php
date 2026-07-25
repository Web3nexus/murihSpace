<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coaching_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_id')->constrained('coaching_services')->cascadeOnDelete();
            $table->dateTime('start_time');
            $table->dateTime('end_time');
            $table->boolean('is_booked')->default(false);
            $table->timestamps();

            $table->index(['service_id', 'start_time', 'is_booked']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coaching_slots');
    }
};
