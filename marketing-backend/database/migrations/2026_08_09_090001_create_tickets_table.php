<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number')->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('subject');
            $table->text('description');
            $table->foreignId('category_id')->nullable()->constrained('ticket_categories')->nullOnDelete();
            $table->string('subcategory')->nullable();
            $table->string('priority')->default('normal');
            $table->string('status')->default('new');
            $table->string('channel');
            $table->foreignId('assigned_agent_id')->nullable()->constrained('staff_users')->nullOnDelete();
            $table->unsignedBigInteger('assigned_team_id')->nullable();
            $table->unsignedBigInteger('sla_policy_id')->nullable();
            $table->unsignedBigInteger('related_order_id')->nullable();
            $table->unsignedBigInteger('related_transaction_id')->nullable();
            $table->string('related_kyc_reference')->nullable();
            $table->unsignedBigInteger('related_community_id')->nullable();
            $table->unsignedBigInteger('related_conference_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('staff_users')->nullOnDelete();
            $table->timestamp('first_response_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'priority']);
            $table->index(['channel', 'created_at']);
            $table->index('assigned_agent_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
