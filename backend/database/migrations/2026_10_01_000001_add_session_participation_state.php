<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Server-authoritative meeting roster. LiveKit gives us media, but the
        // participant list a client renders must survive reconnects and be
        // shared with everyone in the room, so it is persisted here and pushed
        // over the `meeting.{code}` broadcast channel.
        Schema::create('meeting_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role')->default('participant');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_muted')->default(false);
            $table->boolean('is_camera_on')->default(false);
            $table->boolean('is_restricted')->default(false);
            $table->dateTime('joined_at')->nullable();
            $table->dateTime('left_at')->nullable();
            $table->dateTime('last_seen_at')->nullable();
            $table->timestamps();

            $table->unique(['meeting_id', 'user_id']);
            $table->index(['meeting_id', 'is_active']);
        });

        // Live moderation state: co-hosts/moderators and explicit restrictions
        // need somewhere to live so a host decision survives a page reload and
        // is enforced by the API rather than by the browser.
        Schema::table('live_stream_participants', function (Blueprint $table) {
            $table->boolean('is_restricted')->default(false)->after('is_active');
            $table->dateTime('last_seen_at')->nullable()->after('left_at');
        });
    }

    public function down(): void
    {
        Schema::table('live_stream_participants', function (Blueprint $table) {
            $table->dropColumn(['is_restricted', 'last_seen_at']);
        });

        Schema::dropIfExists('meeting_participants');
    }
};
