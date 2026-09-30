<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            // `flag` leaves a report open for closer review rather than
            // resolving it, so it needs its own attribution: who escalated it,
            // when, and why. `reviewed_by` would imply the review finished.
            $table->foreignId('flagged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('flagged_at')->nullable();
            $table->text('flag_note')->nullable();
            $table->unsignedSmallInteger('flag_count')->default(0);

            $table->index(['status', 'flagged_at']);
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropIndex(['status', 'flagged_at']);
            $table->dropColumn(['flagged_by', 'flagged_at', 'flag_note', 'flag_count']);
        });
    }
};
