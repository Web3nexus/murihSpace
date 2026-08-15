<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('pixel_events', function (Blueprint $table) {
            $table->id();
            $table->uuid('pixel_uuid');
            $table->string('event_type'); // PageView, ViewContent, AddToCart, Purchase
            $table->string('user_identifier')->nullable();
            $table->jsonb('event_data')->nullable();
            $table->timestamps();

            $table->foreign('pixel_uuid')->references('pixel_uuid')->on('pixels')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pixel_events');
    }
};
