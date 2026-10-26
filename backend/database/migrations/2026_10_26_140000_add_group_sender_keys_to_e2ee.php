<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Group encryption (sender keys). A group chat has a key epoch that rises whenever
 * its membership changes. Every group message names the epoch it was encrypted
 * under, and the server refuses a message from an older epoch, so a removed member
 * cannot be kept in the loop by a sender who has not rotated.
 *
 * Sender key distributions are opaque 1:1 ciphertexts, one per recipient and epoch.
 * The server stores them until the recipient acknowledges them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->unsignedInteger('e2ee_epoch')->default(0);
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->unsignedInteger('key_epoch')->nullable()->after('ciphertext');
        });

        Schema::create('e2ee_sender_key_envelopes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('recipient_user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('epoch');
            $table->text('ciphertext');
            $table->timestamps();

            $table->unique(['conversation_id', 'sender_user_id', 'recipient_user_id', 'epoch'], 'e2ee_sender_key_envelopes_unique');
            $table->index(['recipient_user_id', 'conversation_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('e2ee_sender_key_envelopes');

        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn('key_epoch');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn('e2ee_epoch');
        });
    }
};
