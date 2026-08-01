<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('post_comments', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->after('id')->constrained('post_comments')->onDelete('cascade');
            $table->unsignedInteger('likes_count')->default(0)->after('content');
            $table->unsignedInteger('dislikes_count')->default(0)->after('likes_count');
        });

        Schema::create('comment_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained('post_comments')->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('type', ['like', 'dislike'])->default('like');
            $table->timestamps();
            $table->unique(['comment_id', 'user_id']);
        });

        Schema::table('communities', function (Blueprint $table) {
            $table->boolean('non_member_can_view')->default(true)->after('rules');
            $table->boolean('new_member_can_comment_immediately')->default(true)->after('non_member_can_view');
            $table->boolean('posts_require_approval')->default(false)->after('new_member_can_comment_immediately');
            $table->boolean('comments_require_moderation')->default(false)->after('posts_require_approval');
            $table->boolean('dislikes_enabled')->default(true)->after('comments_require_moderation');
            $table->boolean('anonymous_posts_allowed')->default(false)->after('dislikes_enabled');
            $table->json('posting_roles')->nullable()->after('anonymous_posts_allowed');
            $table->unsignedInteger('slow_mode_seconds')->default(0)->after('posting_roles');
        });

        Schema::create('community_member_restrictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('type'); // suspended, muted
            $table->timestamp('expires_at')->nullable();
            $table->text('reason')->nullable();
            $table->foreignId('applied_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_member_restrictions');
        Schema::dropIfExists('comment_reactions');

        Schema::table('post_comments', function (Blueprint $table) {
            $table->dropColumn(['parent_id', 'likes_count', 'dislikes_count']);
        });

        Schema::table('communities', function (Blueprint $table) {
            $table->dropColumn([
                'non_member_can_view', 'new_member_can_comment_immediately',
                'posts_require_approval', 'comments_require_moderation',
                'dislikes_enabled', 'anonymous_posts_allowed', 'posting_roles',
                'slow_mode_seconds',
            ]);
        });
    }
};
