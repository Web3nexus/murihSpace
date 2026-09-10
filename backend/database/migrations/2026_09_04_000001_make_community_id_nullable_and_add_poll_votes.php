<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->foreignId('community_id')->nullable()->change();
        });

        if (!Schema::hasTable('post_poll_votes')) {
            Schema::create('post_poll_votes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('post_id')->constrained('posts')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->unsignedSmallInteger('option_index');
                $table->timestamps();

                $table->unique(['post_id', 'user_id']);
                $table->index(['post_id', 'option_index']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('post_poll_votes');

        Schema::table('posts', function (Blueprint $table) {
            $table->foreignId('community_id')->nullable(false)->change();
        });
    }
};
