<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('link_in_bio_designs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('bg')->default('#ffffff');
            $table->string('card_bg')->default('#f5f5f5');
            $table->string('text_color')->default('#1a1a1a');
            $table->string('accent')->default('#2164b6');
            $table->timestamps();
        });

        Schema::create('link_in_bio_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('url');
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('link_in_bio_links');
        Schema::dropIfExists('link_in_bio_designs');
    }
};
