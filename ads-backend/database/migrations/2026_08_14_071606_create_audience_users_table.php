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
        Schema::create('audience_users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audience_id')->constrained('audiences')->onDelete('cascade');
            $table->string('user_identifier'); // can be hashed email, phone, or raw user ID
            $table->timestamps();

            $table->unique(['audience_id', 'user_identifier']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audience_users');
    }
};
