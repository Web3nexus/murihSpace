<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_broadcasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->text('body');
            $table->string('type', 40)->default('announcement'); // announcement, security_alert, system_update, policy_update
            $table->string('target_audience', 40)->default('all'); // all, creators, vendors, members
            $table->string('action_url')->nullable();
            $table->string('action_label')->nullable();
            $table->unsignedInteger('recipients_count')->default(0);
            $table->timestamp('sent_at')->nullable()->index();
            $table->timestamps();

            $table->index(['target_audience', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_broadcasts');
    }
};

