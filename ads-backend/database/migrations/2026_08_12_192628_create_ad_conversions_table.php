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
        Schema::create('ad_conversions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ad_id')->constrained('ads')->onDelete('cascade');
            $table->unsignedBigInteger('user_id'); // ID of the user who converted
            $table->string('type'); // purchase, follow, community
            $table->bigInteger('value')->default(0); // in cents for purchases
            $table->string('reference_id'); // e.g. order_id to prevent duplicates
            $table->timestamps();

            // Prevent duplicate conversions for the same ad and reference
            $table->unique(['ad_id', 'type', 'reference_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ad_conversions');
    }
};
