<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('developer_apps', function (Blueprint $table) {
            $table->id();
            $table->string('app_id')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('client_id')->unique();
            $table->string('client_secret');
            $table->json('redirect_uris')->nullable();
            $table->json('allowed_scopes')->nullable();
            $table->string('user_id'); // MurihSpace canonical user ID
            $table->string('status')->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('developer_apps');
    }
};
