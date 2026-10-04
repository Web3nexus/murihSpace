<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Records that a moderator removed somebody, as distinct from somebody who
 * simply left.
 *
 * Removal used to be a plain `leave()` — a LiveKit disconnect plus
 * `is_active = false`. Because `join()` upserts that same row and sets
 * `is_active = true` again, a removed participant could walk straight back into
 * the roster on their next request and keep publishing, which made the
 * moderation control inert. Stamping the row gives removal a memory, and the
 * presence services refuse to resurrect a stamped row until the meeting or
 * stream ends (the rows cascade away with their parent).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meeting_participants', function (Blueprint $table) {
            $table->dateTime('removed_at')->nullable()->after('left_at');
        });

        Schema::table('live_stream_participants', function (Blueprint $table) {
            $table->dateTime('removed_at')->nullable()->after('left_at');
        });
    }

    public function down(): void
    {
        Schema::table('meeting_participants', function (Blueprint $table) {
            $table->dropColumn('removed_at');
        });

        Schema::table('live_stream_participants', function (Blueprint $table) {
            $table->dropColumn('removed_at');
        });
    }
};