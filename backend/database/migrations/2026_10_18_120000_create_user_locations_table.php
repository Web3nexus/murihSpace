<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Coarse, opt-in location only. Coordinates are rounded to two decimal
        // places (about 1 km) before they are stored, and they are cleared as
        // soon as sharing is turned off.
        Schema::create('user_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('sharing_enabled')->default(false);
            $table->decimal('latitude', 6, 2)->nullable();
            $table->decimal('longitude', 7, 2)->nullable();
            $table->timestamp('captured_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_locations');
    }
};
