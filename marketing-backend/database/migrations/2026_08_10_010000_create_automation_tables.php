<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automation_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('trigger')->default('created')->index();
            $table->json('conditions');
            $table->json('actions');
            $table->unsignedInteger('sort_order')->default(100)->index();
            $table->boolean('enabled')->default(true)->index();
            $table->boolean('stop_after_match')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('last_triggered_at')->nullable();
            $table->unsignedBigInteger('times_triggered')->default(0);
            $table->timestamps();
        });

        Schema::create('automation_rule_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('rule_id')->index();
            $table->unsignedBigInteger('ticket_id')->index();
            $table->boolean('matched')->default(false);
            $table->json('actions')->nullable();
            $table->string('trigger');
            $table->timestamps();

            $table->index(['rule_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_rule_logs');
        Schema::dropIfExists('automation_rules');
    }
};
