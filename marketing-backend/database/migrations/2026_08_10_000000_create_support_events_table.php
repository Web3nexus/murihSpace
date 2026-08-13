<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_key', 100);
            $table->string('event_id', 100)->unique();
            $table->string('actor_type', 40)->nullable();
            $table->string('actor_reference', 100)->nullable();
            $table->string('customer_email', 320)->nullable();
            $table->json('payload')->nullable();
            $table->enum('status', ['received', 'ticket_created', 'ignored'])->default('received');
            $table->string('ticket_number', 30)->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->timestamps();

            $table->index(['event_key', 'occurred_at']);
            $table->index('customer_email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_events');
    }
};
