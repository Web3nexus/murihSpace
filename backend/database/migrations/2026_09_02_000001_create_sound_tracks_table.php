<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('sound_tracks')) {
            Schema::create('sound_tracks', function (Blueprint $table) {
                $table->id();
                $table->string('title');
                $table->string('artist')->nullable();
                $table->string('audio_url');
                $table->string('cover_url')->nullable();
                $table->integer('duration')->default(0); // in seconds
                $table->string('category')->default('General');
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sound_tracks');
    }
};
