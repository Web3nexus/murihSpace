<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('digital_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('cover_url')->nullable();
            $table->decimal('price', 10, 2)->default(0.00);
            $table->string('currency', 3)->default('USD');
            $table->boolean('is_free')->default(false);
            $table->string('status')->default('draft'); // 'draft', 'published'
            $table->string('category')->default('other'); // 'ebook', 'template', 'course', 'audio', 'graphics', 'other'
            $table->string('file_path')->nullable(); // Private storage path
            $table->string('file_original_name')->nullable();
            $table->string('file_mime_type')->nullable();
            $table->unsignedBigInteger('file_size_bytes')->default(0);
            $table->unsignedInteger('download_count')->default(0);
            $table->timestamps();

            $table->index(['creator_id', 'status']);
            $table->index('category');
            $table->index('slug');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('digital_products');
    }
};
