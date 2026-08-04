<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('event_type');
            $table->string('severity')->default('warning');
            $table->string('environment')->default('production');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('affected_service')->nullable();
            $table->string('reference')->nullable();
            $table->json('metadata')->nullable();
            $table->json('channels')->nullable();
            $table->boolean('requires_acknowledgement')->default(false);
            $table->string('status')->default('new');
            $table->timestamp('acknowledged_at')->nullable();
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('acknowledgement_note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_alerts');
    }
};
