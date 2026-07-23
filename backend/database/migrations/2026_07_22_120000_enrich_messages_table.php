<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->foreignId('reply_to_id')->nullable()->constrained('messages')->nullOnDelete()->after('type');
            $table->string('attachment_url')->nullable()->after('reply_to_id');
            $table->string('attachment_type')->nullable()->after('attachment_url'); // 'image', 'file', 'voice'
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropForeign(['reply_to_id']);
            $table->dropColumn(['reply_to_id', 'attachment_url', 'attachment_type']);
        });
    }
};
