<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('phone_otp_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('phone_e164', 20)->index();
            $table->string('country_iso2', 2)->nullable();
            $table->string('intent', 20)->default('login'); // register | login | verify_new | change
            $table->string('driver', 20)->default('twilio');
            $table->string('twilio_sid', 255)->nullable();
            // Only used by the non-Twilio (log/dev) driver: a SHA-256 hash of the
            // code, never the plaintext code.
            $table->string('code_hash', 64)->nullable();
            $table->timestamp('code_expires_at')->nullable();
            $table->string('status', 20)->default('requested'); // requested | verified | failed | expired | blocked | rate_limited
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('device_id', 255)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['phone_e164', 'intent', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('phone_otp_requests');
    }
};
