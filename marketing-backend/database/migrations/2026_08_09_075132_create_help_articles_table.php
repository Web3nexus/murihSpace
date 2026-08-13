<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('help_articles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained('help_categories')->nullOnDelete();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('excerpt')->nullable();
            $table->longText('body');
            $table->json('sections')->nullable();
            $table->json('keywords')->nullable();
            $table->json('tags')->nullable();
            $table->string('state')->default('draft')->index();
            $table->boolean('featured')->default(false);
            $table->string('seo_title')->nullable();
            $table->string('seo_description')->nullable();
            $table->string('canonical_url')->nullable();
            $table->unsignedInteger('view_count')->default(0);
            $table->unsignedInteger('helpful_count')->default(0);
            $table->unsignedInteger('not_helpful_count')->default(0);
            $table->timestamp('published_at')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->index(['state', 'published_at']);
            $table->index(['category_id', 'state']);
        });

        Schema::create('help_article_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained('help_articles')->cascadeOnDelete();
            $table->unsignedInteger('revision_number')->default(1);
            $table->string('title');
            $table->text('excerpt')->nullable();
            $table->longText('body');
            $table->json('sections')->nullable();
            $table->json('keywords')->nullable();
            $table->json('tags')->nullable();
            $table->string('seo_title')->nullable();
            $table->string('seo_description')->nullable();
            $table->string('canonical_url')->nullable();
            $table->string('created_by_type')->nullable();
            $table->unsignedBigInteger('created_by_id')->nullable();
            $table->string('note')->nullable();
            $table->timestamps();

            $table->unique(['article_id', 'revision_number']);
        });

        Schema::create('help_article_feedback', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained('help_articles')->cascadeOnDelete();
            $table->boolean('helpful')->nullable();
            $table->text('comment')->nullable();
            $table->string('user_email')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index('article_id');
        });

        Schema::create('help_article_relations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained('help_articles')->cascadeOnDelete();
            $table->foreignId('related_article_id')->constrained('help_articles')->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['article_id', 'related_article_id']);
        });

        Schema::create('help_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained('help_articles')->cascadeOnDelete();
            $table->string('disk')->default('local');
            $table->string('path');
            $table->string('filename');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();

            $table->index('article_id');
        });

        Schema::create('help_search_terms', function (Blueprint $table) {
            $table->id();
            $table->string('query')->index();
            $table->unsignedInteger('result_count')->default(0);
            $table->foreignId('selected_article_id')->nullable()->constrained('help_articles')->nullOnDelete();
            $table->boolean('user_feedback')->nullable();
            $table->string('user_email')->nullable();
            $table->timestamps();

            $table->index(['query', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('help_search_terms');
        Schema::dropIfExists('help_attachments');
        Schema::dropIfExists('help_article_relations');
        Schema::dropIfExists('help_article_feedback');
        Schema::dropIfExists('help_article_revisions');
        Schema::dropIfExists('help_articles');
    }
};
