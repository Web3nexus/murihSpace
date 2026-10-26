<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('encrypted_attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->string('disk', 64);
            $table->string('object_path', 191)->unique();
            $table->unsignedBigInteger('size_bytes');
            $table->string('content_type', 100)->default('application/octet-stream');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at']);
            $table->index(['conversation_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('encrypted_attachments');
    }
};
