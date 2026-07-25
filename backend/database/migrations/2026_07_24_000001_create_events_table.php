<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('event_type')->default('online');
            $table->dateTime('start_date');
            $table->dateTime('end_date');
            $table->string('timezone')->default('UTC');
            $table->string('location')->nullable();
            $table->string('meeting_url')->nullable();
            $table->string('cover_url')->nullable();
            $table->unsignedInteger('capacity')->nullable();
            $table->dateTime('registration_deadline')->nullable();
            $table->string('status')->default('draft');
            $table->boolean('is_featured')->default(false);
            $table->timestamps();

            $table->index(['community_id', 'status', 'start_date']);
            $table->index(['creator_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
