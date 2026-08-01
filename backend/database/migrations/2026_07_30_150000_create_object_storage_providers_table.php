<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('object_storage_providers', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('label');
            $table->string('driver')->default('s3');
            $table->string('access_key');
            $table->text('secret_key');
            $table->string('region')->nullable();
            $table->string('bucket');
            $table->string('endpoint')->nullable();
            $table->string('url')->nullable();
            $table->boolean('use_path_style_endpoint')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('object_storage_providers');
    }
};
