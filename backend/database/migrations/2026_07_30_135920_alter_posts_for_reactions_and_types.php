<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->unsignedInteger('dislikes_count')->default(0)->after('likes_count');
            $table->unsignedInteger('shares_count')->default(0)->after('comments_count');
            $table->unsignedInteger('saves_count')->default(0)->after('shares_count');
            $table->unsignedInteger('views_count')->default(0)->after('saves_count');
            $table->json('hashtags')->nullable()->after('link_url');
            $table->json('mentions')->nullable()->after('hashtags');
            $table->string('location', 255)->nullable()->after('mentions');
            $table->string('privacy', 50)->default('public')->after('is_draft');
            $table->boolean('comments_disabled')->default(false)->after('privacy');
            $table->text('accessibility_text')->nullable()->after('content');
            $table->string('poll_question', 500)->nullable()->after('accessibility_text');
            $table->json('poll_options')->nullable()->after('poll_question');
            $table->timestamp('poll_ends_at')->nullable()->after('poll_options');
            $table->string('cta_text', 100)->nullable()->after('poll_ends_at');
            $table->string('cta_url', 500)->nullable()->after('cta_text');
        });

        Schema::table('post_reactions', function (Blueprint $table) {
            $table->dropUnique('post_reactions_post_id_user_id_reaction_type_unique');
        });

        DB::statement("ALTER TABLE post_reactions ALTER COLUMN reaction_type TYPE VARCHAR(20)");

        Schema::table('post_reactions', function (Blueprint $table) {
            $table->unique(['post_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn([
                'dislikes_count', 'shares_count', 'saves_count', 'views_count',
                'hashtags', 'mentions', 'location',
                'privacy', 'comments_disabled', 'accessibility_text',
                'poll_question', 'poll_options', 'poll_ends_at',
                'cta_text', 'cta_url',
            ]);
        });

        Schema::table('post_reactions', function (Blueprint $table) {
            $table->dropUnique('post_reactions_post_id_user_id_unique');
        });

        DB::statement("ALTER TABLE post_reactions ALTER COLUMN reaction_type TYPE VARCHAR(20)");

        Schema::table('post_reactions', function (Blueprint $table) {
            $table->unique(['post_id', 'user_id', 'reaction_type']);
        });
    }
};
