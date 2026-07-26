<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_broadcasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('subject');
            $table->text('content');
            $table->string('status')->default('draft');
            $table->unsignedInteger('recipient_count')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('open_count')->default(0);
            $table->unsignedInteger('click_count')->default(0);
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['creator_id', 'status']);
        });

        Schema::create('email_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('trigger_event')->default('purchase');
            $table->string('status')->default('draft');
            $table->boolean('is_active')->default(false);
            $table->timestamps();

            $table->index(['creator_id']);
        });

        Schema::create('email_sequence_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('email_sequence_id')->constrained('email_sequences')->cascadeOnDelete();
            $table->string('subject');
            $table->text('content');
            $table->unsignedSmallInteger('delay_days')->default(0);
            $table->unsignedSmallInteger('order')->default(0);
            $table->timestamps();

            $table->index(['email_sequence_id', 'order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_sequence_steps');
        Schema::dropIfExists('email_sequences');
        Schema::dropIfExists('email_broadcasts');
    }
};
