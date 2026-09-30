<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // An automatic finding has no human reporter. The column was
        // non-nullable, which left two bad options: recording the author of the
        // offending content as the reporter — so the moderation queue would
        // display the person under review as the person who raised it — or
        // attributing the report to a placeholder administrator. Nullable is
        // the honest representation; who wrote the content is already recorded
        // in `moderation_rule_logs.author_id`.
        Schema::table('reports', function (Blueprint $table) {
            $table->unsignedBigInteger('reporter_id')->nullable()->change();
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->dropForeign(['reporter_id']);
            $table->foreign('reporter_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropForeign(['reporter_id']);
            $table->foreign('reporter_id')->references('id')->on('users')->cascadeOnDelete();
            $table->unsignedBigInteger('reporter_id')->nullable(false)->change();
        });
    }
};
