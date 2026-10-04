<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // `edited_at` already marks that an edit happened; the counter lets
            // the UI and the audit trail report it without an N+1 on edits.
            $table->unsignedInteger('edit_count')->default(0)->after('edited_at');
        });

        // Every revision is retained, including the text a sender first posted.
        // Overwriting `messages.content` in place would destroy the only copy of
        // what was actually said, which matters for moderation, disputes and the
        // financial-chat audit archive.
        Schema::create('message_edits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained('messages')->cascadeOnDelete();
            $table->foreignId('editor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('previous_content');
            $table->text('content');
            $table->timestamps();

            $table->index(['message_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_edits');

        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn('edit_count');
        });
    }
};