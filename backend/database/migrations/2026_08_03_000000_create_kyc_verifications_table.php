<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kyc_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('provider', 50);
            $table->string('status', 20)->default('pending');
            $table->string('provider_session_id')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->string('rejection_code')->nullable();
            $table->json('provider_metadata')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'provider_session_id'], 'kyc_verif_provider_session_unique');
            $table->index(['user_id', 'status']);
            $table->index(['status', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kyc_verifications');
    }
};
