<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('moderation_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('category');
            $table->string('severity')->default('medium');
            $table->string('match_type')->default('keyword');
            $table->json('patterns');
            $table->json('applies_to')->nullable();
            $table->boolean('enabled')->default(true);
            $table->unsignedBigInteger('times_matched')->default(0);
            $table->unsignedBigInteger('reports_upheld')->default(0);
            $table->unsignedBigInteger('reports_dismissed')->default(0);
            $table->timestamps();

            $table->index(['enabled', 'category']);
        });

        Schema::create('moderation_rule_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rule_id')->constrained('moderation_rules')->cascadeOnDelete();
            $table->foreignId('report_id')->nullable()->constrained('reports')->nullOnDelete();
            $table->string('content_type');
            $table->unsignedBigInteger('content_id');
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('matched_pattern', 191)->nullable();
            $table->string('snippet', 500)->nullable();
            $table->string('action')->default('flagged');
            $table->timestamps();

            $table->index(['rule_id', 'created_at']);
            $table->index(['content_type', 'content_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moderation_rule_logs');
        Schema::dropIfExists('moderation_rules');
    }
};
