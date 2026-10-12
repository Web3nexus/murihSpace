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
        Schema::table('badges', function (Blueprint $table) {
            $table->string('icon_3d')->nullable()->after('icon');
            $table->string('icon_gradient')->nullable()->after('color');
            $table->string('level_label')->nullable()->after('name');
            $table->unsignedInteger('awarded_count')->default(0)->after('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('badges', function (Blueprint $table) {
            $table->dropColumn(['icon_3d', 'icon_gradient', 'level_label', 'awarded_count']);
        });
    }
};
