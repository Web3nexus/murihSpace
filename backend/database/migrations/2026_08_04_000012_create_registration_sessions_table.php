<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('registration_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->string('phone_e164', 20)->index();
            $table->string('country_iso2', 2)->nullable();
            $table->string('verification_status', 20)->default('pending'); // pending | verified | expired | consumed
            $table->timestamp('expires_at');
            $table->unsignedTinyInteger('attempt_count')->default(0);
            $table->string('device_id', 255)->nullable();
            $table->string('client_fingerprint', 255)->nullable();
            $table->foreignId('completed_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registration_sessions');
    }
};
