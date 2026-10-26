<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Encrypted message envelope. For end-to-end messages the client encrypts on the
 * device and sends only `ciphertext`. `content` stays empty, so the server never
 * stores plaintext for these rows. Existing rows keep `encryption` null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->string('encryption', 32)->nullable()->after('content');
            $table->text('ciphertext')->nullable()->after('encryption');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['encryption', 'ciphertext']);
        });
    }
};
