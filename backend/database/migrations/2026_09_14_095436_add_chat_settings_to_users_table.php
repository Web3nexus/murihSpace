<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_seen_at')->nullable()->after('updated_at');
            $table->boolean('show_online_status')->default(true)->after('last_seen_at');
            $table->boolean('read_receipts_enabled')->default(true)->after('show_online_status');
            $table->boolean('chat_sounds_enabled')->default(true)->after('read_receipts_enabled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'last_seen_at',
                'show_online_status',
                'read_receipts_enabled',
                'chat_sounds_enabled',
            ]);
        });
    }
};
