<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('communities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('category')->default('General')->index();
            $table->enum('visibility', ['public', 'private'])->default('public');
            $table->enum('pricing_type', ['free', 'paid'])->default('free');
            $table->decimal('price_amount', 10, 2)->nullable();
            $table->string('logo_url')->nullable();
            $table->string('cover_url')->nullable();
            $table->json('rules')->nullable();
            $table->unsignedInteger('members_count')->default(1);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('communities');
    }
};
