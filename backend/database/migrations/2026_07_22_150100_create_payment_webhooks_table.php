<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_webhooks', function (Blueprint $table) {
            $table->id();
            $table->string('provider');          // 'stripe', 'paypal', 'mock'
            $table->string('event_id')->unique(); // Prevents duplicate webhook processing
            $table->string('event_type');
            $table->json('payload');
            $table->string('status')->default('processed'); // 'processed', 'ignored', 'failed'
            $table->timestamps();

            $table->index(['provider', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_webhooks');
    }
};
