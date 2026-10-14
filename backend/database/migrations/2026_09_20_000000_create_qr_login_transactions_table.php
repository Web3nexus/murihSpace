<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('qr_login_transactions', function (Blueprint $table) {
            $table->id();

            // Public half of the pairing secret. Encoded into the QR image and
            // sent by the mobile app to identify the transaction. Safe to be
            // photographed: on its own it authorises nothing.
            $table->string('qr_token', 64)->unique();

            // Secret half, held only by the desktop that started the flow and
            // used to poll for the result. Stored hashed so a database leak
            // cannot be replayed to steal a freshly minted session token.
            $table->string('poll_token_hash', 64)->unique();

            // pending -> scanned -> approved | denied | expired | consumed
            $table->string('status', 30)->default('pending');

            // Set when the mobile app scans the code and confirms the account.
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();

            // Details of the DESKTOP that requested the login (for the approval
            // prompt shown on the phone and for the resulting device session).
            $table->string('device_id')->nullable();
            $table->string('device_name')->nullable();
            $table->string('platform', 50)->nullable();
            $table->string('ip', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('location', 100)->nullable();

            $table->foreignId('approved_by_device_session_id')->nullable()
                ->constrained('device_sessions')->nullOnDelete();

            $table->timestamp('scanned_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('denied_at')->nullable();
            $table->timestamp('expires_at');

            // Encrypted Sanctum token, delivered exactly once to the desktop.
            $table->text('authorized_token')->nullable();

            $table->timestamps();

            $table->index(['status', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qr_login_transactions');
    }
};
