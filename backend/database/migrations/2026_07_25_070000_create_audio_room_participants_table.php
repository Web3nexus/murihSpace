<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audio_room_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audio_room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role')->default('listener');
            $table->dateTime('joined_at');
            $table->dateTime('left_at')->nullable();
            $table->boolean('is_muted')->default(false);
            $table->boolean('is_hand_raised')->default(false);
            $table->timestamps();

            $table->unique(['audio_room_id', 'user_id']);
            $table->index(['audio_room_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audio_room_participants');
    }
};
