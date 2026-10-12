<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Real hashtag tracking for Discover / trending topics.
     *
     * `hashtags` holds the all-time aggregate for a normalised tag, while
     * `hashtag_stats` stores one row per tag per day so a time-decayed
     * "trending" score can be computed without scanning the posts table.
     */
    public function up(): void
    {
        Schema::create('hashtags', function (Blueprint $table) {
            $table->id();
            $table->string('tag', 100)->unique();        // normalised, lowercase, no '#'
            $table->string('display_tag', 120);          // display casing, no '#'
            $table->unsignedInteger('posts_count')->default(0);
            $table->timestamp('first_used_at')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->index('posts_count');
            $table->index('last_used_at');
        });

        Schema::create('hashtag_stats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hashtag_id')->constrained('hashtags')->cascadeOnDelete();
            $table->date('date');
            $table->unsignedInteger('posts_count')->default(0);
            $table->timestamps();

            $table->unique(['hashtag_id', 'date']);
            $table->index('date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hashtag_stats');
        Schema::dropIfExists('hashtags');
    }
};
