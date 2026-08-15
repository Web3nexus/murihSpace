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
        Schema::create('ad_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('advertiser_id')->constrained('advertisers')->onDelete('cascade');
            $table->integer('creator_user_id')->index(); // MurihSpace user ID of the creator
            $table->string('status')->default('pending'); // pending, active, revoked
            $table->timestamps();

            $table->unique(['advertiser_id', 'creator_user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ad_permissions');
    }
};
