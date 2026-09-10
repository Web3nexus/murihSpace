<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('live_streams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('community_id')->nullable()->constrained('communities')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('stream_mode', 30)->default('video'); // video, audio, meeting
            $table->string('status', 30)->default('preparing'); // preparing, live, ended
            $table->string('livekit_room')->unique();
            $table->unsignedInteger('viewers_count')->default(0);
            $table->unsignedInteger('peak_viewers')->default(0);
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedBigInteger('total_coins_earned')->default(0);
            $table->string('background_sound', 100)->nullable();
            $table->unsignedBigInteger('pinned_product_id')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index('user_id');
        });

        Schema::create('live_stream_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_stream_id')->constrained('live_streams')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('role', 30)->default('viewer'); // host, co-host, moderator, viewer
            $table->boolean('is_active')->default(true);
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamp('left_at')->nullable();
            $table->timestamps();

            $table->index(['live_stream_id', 'is_active']);
        });

        Schema::create('live_stream_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_stream_id')->constrained('live_streams')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->unsignedInteger('count')->default(1);
            $table->timestamps();

            $table->index(['live_stream_id', 'created_at']);
        });

        Schema::create('live_stream_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_stream_id')->constrained('live_streams')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->text('message');
            $table->boolean('is_pinned')->default(false);
            $table->timestamps();

            $table->index(['live_stream_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('live_stream_messages');
        Schema::dropIfExists('live_stream_likes');
        Schema::dropIfExists('live_stream_participants');
        Schema::dropIfExists('live_streams');
    }
};

