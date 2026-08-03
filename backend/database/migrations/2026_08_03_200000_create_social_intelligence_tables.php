<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('provider'); // instagram|tiktok|youtube|facebook|x|linkedin|twitch
            $table->string('provider_user_id')->nullable();
            $table->string('username')->nullable();
            $table->string('profile_url')->nullable();
            $table->unsignedBigInteger('follower_count')->nullable();
            $table->unsignedBigInteger('following_count')->nullable();
            $table->boolean('verified_on_provider')->default(false);
            $table->boolean('count_is_self_reported')->default(false); // true when manually entered
            $table->text('access_token_reference')->nullable(); // encrypted token key reference
            $table->timestamp('connected_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->enum('sync_status', ['pending', 'synced', 'error', 'revoked'])->default('pending');
            $table->json('raw_metadata')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'provider']); // one per provider per user
            $table->index(['user_id', 'sync_status']);
        });

        Schema::create('social_follower_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('combined_followers')->default(0);
            $table->json('provider_breakdown'); // {instagram: 5000, youtube: 8000}
            $table->unsignedBigInteger('threshold_at_time')->default(0);
            $table->timestamp('captured_at');
            $table->timestamps();

            $table->index(['user_id', 'captured_at']);
        });

        Schema::create('creator_qualification_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('snapshot_id')->nullable()->constrained('social_follower_snapshots')->nullOnDelete();
            $table->enum('status', ['pending', 'notified', 'accepted', 'declined', 'expired'])->default('pending');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('notified_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('creator_qualification_events');
        Schema::dropIfExists('social_follower_snapshots');
        Schema::dropIfExists('social_accounts');
    }
};
