<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Public key directory for end-to-end encryption (Signal protocol, as used by
 * WhatsApp). Only public keys live here. Private keys stay on the device, and
 * message contents are encrypted on the device before they reach the server.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('e2ee_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_uuid', 64);
            $table->unsignedInteger('registration_id');
            $table->string('identity_key', 256);
            $table->unsignedInteger('signed_prekey_id');
            $table->string('signed_prekey_public', 256);
            $table->string('signed_prekey_signature', 256);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'device_uuid']);
        });

        Schema::create('e2ee_one_time_prekeys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('e2ee_device_id')->constrained('e2ee_devices')->cascadeOnDelete();
            $table->unsignedInteger('key_id');
            $table->string('public_key', 256);
            $table->timestamp('claimed_at')->nullable();
            $table->timestamps();

            $table->unique(['e2ee_device_id', 'key_id']);
            $table->index(['e2ee_device_id', 'claimed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('e2ee_one_time_prekeys');
        Schema::dropIfExists('e2ee_devices');
    }
};
