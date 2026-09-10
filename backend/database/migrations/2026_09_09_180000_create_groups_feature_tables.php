<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('groups')) {
            Schema::create('groups', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique();
                $table->text('description')->nullable();
                $table->string('avatar_url')->nullable();
                $table->string('cover_url')->nullable();
                $table->string('category')->default('General');
                $table->enum('privacy', ['public', 'private', 'invite_only'])->default('public');
                $table->enum('discoverability', ['discoverable', 'hidden'])->default('discoverable');
                $table->text('rules')->nullable();
                $table->json('tags')->nullable();
                $table->string('website')->nullable();
                $table->string('location')->nullable();
                $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
                $table->unsignedInteger('members_count')->default(1);
                $table->unsignedInteger('posts_count')->default(0);
                $table->timestamps();
                $table->softDeletes();

                $table->index(['category', 'privacy']);
                $table->index('creator_id');
            });
        }

        if (!Schema::hasTable('group_members')) {
            Schema::create('group_members', function (Blueprint $table) {
                $table->id();
                $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->enum('role', ['owner', 'admin', 'moderator', 'member'])->default('member');
                $table->enum('status', ['active', 'pending', 'invited', 'banned'])->default('active');
                $table->timestamp('muted_until')->nullable();
                $table->timestamp('joined_at')->nullable();
                $table->timestamps();

                $table->unique(['group_id', 'user_id']);
                $table->index(['group_id', 'role']);
                $table->index(['user_id', 'status']);
            });
        }

        if (!Schema::hasTable('group_join_requests')) {
            Schema::create('group_join_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
                $table->text('note')->nullable();
                $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('reviewed_at')->nullable();
                $table->timestamps();

                $table->index(['group_id', 'status']);
                $table->index(['user_id', 'status']);
            });
        }

        if (!Schema::hasTable('group_invitations')) {
            Schema::create('group_invitations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
                $table->foreignId('inviter_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('invitee_id')->nullable()->constrained('users')->cascadeOnDelete();
                $table->string('code')->unique();
                $table->unsignedInteger('max_uses')->nullable();
                $table->unsignedInteger('uses_count')->default(0);
                $table->enum('status', ['pending', 'accepted', 'declined', 'expired'])->default('pending');
                $table->timestamp('expires_at')->nullable();
                $table->timestamps();

                $table->index(['group_id', 'status']);
                $table->index(['invitee_id', 'status']);
            });
        }

        if (!Schema::hasTable('group_settings')) {
            Schema::create('group_settings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('group_id')->unique()->constrained('groups')->cascadeOnDelete();
                $table->boolean('post_approval')->default(false);
                $table->enum('who_can_post', ['all_members', 'admins_only'])->default('all_members');
                $table->enum('who_can_chat', ['all_members', 'admins_only'])->default('all_members');
                $table->enum('who_can_invite', ['all_members', 'admins_only'])->default('all_members');
                $table->unsignedInteger('slow_mode_seconds')->default(0);
                $table->json('blocked_keywords')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('posts') && !Schema::hasColumn('posts', 'group_id')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->foreignId('group_id')->nullable()->after('community_id')->constrained('groups')->nullOnDelete();
            });
        }

        if (Schema::hasTable('conversations') && !Schema::hasColumn('conversations', 'group_id')) {
            Schema::table('conversations', function (Blueprint $table) {
                $table->foreignId('group_id')->nullable()->after('community_id')->constrained('groups')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('conversations') && Schema::hasColumn('conversations', 'group_id')) {
            Schema::table('conversations', function (Blueprint $table) {
                $table->dropConstrainedForeignId('group_id');
            });
        }

        if (Schema::hasTable('posts') && Schema::hasColumn('posts', 'group_id')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->dropConstrainedForeignId('group_id');
            });
        }

        Schema::dropIfExists('group_settings');
        Schema::dropIfExists('group_invitations');
        Schema::dropIfExists('group_join_requests');
        Schema::dropIfExists('group_members');
        Schema::dropIfExists('groups');
    }
};
