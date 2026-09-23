<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('broadcast_channels')) {
            Schema::create('broadcast_channels', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('name');
                $table->string('handle')->unique();
                $table->text('description')->nullable();
                $table->boolean('allow_replies')->default(false);
                $table->enum('linked_type', ['page', 'group', 'community'])->default('page');
                $table->unsignedBigInteger('linked_id')->nullable();
                $table->unsignedInteger('recipients_count')->default(0);
                $table->timestamps();

                $table->index(['user_id']);
                $table->index(['linked_type', 'linked_id']);
            });
        }

        if (! Schema::hasTable('broadcast_channel_members')) {
            Schema::create('broadcast_channel_members', function (Blueprint $table) {
                $table->id();
                $table->foreignId('broadcast_channel_id')->constrained('broadcast_channels')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->enum('status', ['active', 'removed'])->default('active');
                $table->timestamp('joined_at')->nullable();
                $table->timestamps();

                $table->unique(['broadcast_channel_id', 'user_id']);
                $table->index(['user_id', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('broadcast_channel_members');
        Schema::dropIfExists('broadcast_channels');
    }
};