<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->string('reported_type'); // 'post', 'user', 'comment'
            $table->unsignedBigInteger('reported_id');
            $table->string('reason'); // spam, harassment, inappropriate, misinformation, other
            $table->text('details')->nullable();
            $table->string('status')->default('pending'); // pending, reviewed, dismissed, actioned
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('review_note')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['reported_type', 'reported_id']);
            $table->index('status');
        });

        Schema::create('user_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('blocker_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('blocked_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['blocker_id', 'blocked_id']);
        });

        Schema::create('user_mutes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('muter_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('muted_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['muter_id', 'muted_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_mutes');
        Schema::dropIfExists('user_blocks');
        Schema::dropIfExists('reports');
    }
};
