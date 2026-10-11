<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Idle-broadcast tracking: when the last engagement (like, chat message or
     * new viewer) happened, and when the host was last nudged about inactivity.
     */
    public function up(): void
    {
        Schema::table('live_streams', function (Blueprint $table) {
            $table->timestamp('last_engagement_at')->nullable()->after('started_at');
            $table->timestamp('idle_warned_at')->nullable()->after('last_engagement_at');
        });
    }

    public function down(): void
    {
        Schema::table('live_streams', function (Blueprint $table) {
            $table->dropColumn(['last_engagement_at', 'idle_warned_at']);
        });
    }
};
