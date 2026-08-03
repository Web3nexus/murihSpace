<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kyc_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 50);
            $table->string('provider_event_id')->nullable();
            $table->string('provider_session_id')->nullable();
            $table->string('type', 100)->nullable();
            $table->string('status', 50)->nullable();
            $table->string('processing_status', 20)->default('pending');
            $table->json('raw_payload')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->string('processing_error')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'provider_event_id'], 'kyc_webhook_provider_event_unique');
            $table->index(['provider', 'provider_session_id']);
            $table->index(['processing_status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kyc_webhook_events');
    }
};
