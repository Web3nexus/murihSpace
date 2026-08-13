<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cms_content', function (Blueprint $table) {
            $table->id();
            $table->string('section')->index();
            $table->string('slug');
            $table->string('title')->nullable();
            $table->text('excerpt')->nullable();
            $table->longText('body')->nullable();
            $table->json('content')->nullable();
            $table->string('state')->default('draft')->index();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('seo_title')->nullable();
            $table->string('seo_description')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->unique(['section', 'slug']);
            $table->index(['section', 'state', 'sort_order']);
        });

        Schema::create('cms_content_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_id')->constrained('cms_content')->cascadeOnDelete();
            $table->unsignedInteger('revision_number')->default(1);
            $table->string('title')->nullable();
            $table->text('excerpt')->nullable();
            $table->longText('body')->nullable();
            $table->json('content')->nullable();
            $table->string('seo_title')->nullable();
            $table->string('seo_description')->nullable();
            $table->string('created_by_type')->nullable();
            $table->unsignedBigInteger('created_by_id')->nullable();
            $table->string('note')->nullable();
            $table->timestamps();

            $table->unique(['content_id', 'revision_number']);
        });

        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('state')->default('draft')->index();
            $table->boolean('featured')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->string('created_by_type')->nullable();
            $table->unsignedBigInteger('created_by_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('cms_content_revisions');
        Schema::dropIfExists('cms_content');
    }
};
