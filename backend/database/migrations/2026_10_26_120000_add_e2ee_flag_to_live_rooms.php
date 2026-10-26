<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Marks rooms whose media is end-to-end encrypted on the client (LiveKit E2EE).
     * The server never holds the room key; this flag only tells the server and
     * the UI which rooms it cannot record or transcode.
     */
    public function up(): void
    {
        Schema::table('live_streams', function (Blueprint $table) {
            $table->boolean('e2ee')->default(false)->after('stream_mode');
        });

        Schema::table('audio_rooms', function (Blueprint $table) {
            $table->boolean('e2ee')->default(false)->after('is_recorded');
        });
    }

    public function down(): void
    {
        Schema::table('live_streams', function (Blueprint $table) {
            $table->dropColumn('e2ee');
        });

        Schema::table('audio_rooms', function (Blueprint $table) {
            $table->dropColumn('e2ee');
        });
    }
};
