<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storefronts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->boolean('is_published')->default(false);
            $table->string('display_name');
            $table->string('tagline')->nullable();
            $table->text('bio')->nullable();
            $table->string('cover_url')->nullable();
            $table->string('avatar_url')->nullable();
            $table->string('short_code')->unique();
            $table->json('links')->nullable(); // [{label: string, url: string}]
            $table->timestamps();

            $table->index('short_code');
            $table->index('is_published');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storefronts');
    }
};
