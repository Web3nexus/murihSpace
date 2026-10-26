<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Encrypted key backup for end-to-end encryption. The row holds ciphertext only:
 * the browser encrypts the device state with a key derived from the user's
 * passphrase, so the server cannot read it. One backup per user, replaced on save.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('e2ee_backups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('version');
            $table->string('salt', 128);
            $table->string('iv', 64);
            $table->unsignedInteger('iterations');
            $table->text('ciphertext');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('e2ee_backups');
    }
};
