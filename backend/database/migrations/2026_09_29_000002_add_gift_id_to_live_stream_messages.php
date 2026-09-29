<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('live_stream_messages', function (Blueprint $table) {
            $table->foreignId('gift_id')
                ->nullable()
                ->after('user_id')
                ->constrained('gifts')
                ->nullOnDelete()
                ->index();
        });
    }

    public function down(): void
    {
        Schema::table('live_stream_messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('gift_id');
        });
    }
};