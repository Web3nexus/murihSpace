<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the post-quantum (Kyber1024) prekey to each device. Signal's PQXDH handshake
 * needs it, so a session cannot start without it. Its public key is about 2.1 KB once
 * base64 encoded, which is why the key columns are text.
 *
 * The three key columns that were string(256) are widened to text with change(), which
 * Laravel 13 performs natively (no doctrine/dbal). Their NOT NULL constraint is kept.
 * The Kyber columns are nullable only because existing rows have no value; the API
 * requires them on register.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e2ee_devices', function (Blueprint $table) {
            $table->unsignedInteger('kyber_prekey_id')->nullable();
            $table->text('kyber_prekey_public')->nullable();
            $table->text('kyber_prekey_signature')->nullable();

            $table->text('identity_key')->change();
            $table->text('signed_prekey_public')->change();
            $table->text('signed_prekey_signature')->change();
        });
    }

    public function down(): void
    {
        // The key columns keep their text type on rollback, since shrinking them back to
        // string(256) would fail on any row holding a Kyber-sized key. Only the Kyber
        // columns are removed.
        Schema::table('e2ee_devices', function (Blueprint $table) {
            $table->dropColumn(['kyber_prekey_id', 'kyber_prekey_public', 'kyber_prekey_signature']);
        });
    }
};
