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
        if (!Schema::hasColumn('ads', 'creative_id')) {
            Schema::table('ads', function (Blueprint $table) {
                $table->foreignId('creative_id')->nullable()->constrained('creatives')->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('ads', 'creative_id')) {
            Schema::table('ads', function (Blueprint $table) {
                $table->dropForeign(['creative_id']);
                $table->dropColumn('creative_id');
            });
        }
    }
};
