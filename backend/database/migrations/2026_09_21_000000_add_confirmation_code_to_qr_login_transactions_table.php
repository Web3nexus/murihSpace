<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('qr_login_transactions', function (Blueprint $table) {
            // Hashed short confirmation code shown only on the DESKTOP that
            // started the flow. The scanning phone must read it off that screen
            // and send it back on approval, proving the approver can see the
            // originating device (defeats QR-jacking where the victim scans a
            // code they cannot see the screen for).
            $table->string('confirmation_code_hash', 64)->nullable()->after('authorized_token');

            // Guards the 6-digit space against brute-force retries within the
            // (short) transaction TTL.
            $table->unsignedTinyInteger('confirmation_attempts')->default(0)->after('confirmation_code_hash');
        });
    }

    public function down(): void
    {
        Schema::table('qr_login_transactions', function (Blueprint $table) {
            $table->dropColumn(['confirmation_code_hash', 'confirmation_attempts']);
        });
    }
};
