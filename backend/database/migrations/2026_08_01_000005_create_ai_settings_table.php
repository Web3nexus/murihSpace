<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('persona', 80)->nullable();
            $table->string('tone', 120)->nullable();
            $table->json('focus_topics')->nullable();
            $table->boolean('keep_on_topic')->default(true);
            $table->string('off_topic_mode', 20)->default('redirect');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_settings');
    }
};
