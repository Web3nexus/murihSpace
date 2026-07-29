<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('course_lessons', function (Blueprint $table) {
            $table->foreignId('module_id')->nullable()->after('course_id')->constrained('course_modules')->cascadeOnDelete();
            $table->boolean('is_free')->default(false)->after('sort_order');
            $table->integer('duration_minutes')->nullable()->after('is_free');
        });
    }

    public function down(): void
    {
        Schema::table('course_lessons', function (Blueprint $table) {
            $table->dropForeign(['module_id']);
            $table->dropColumn(['module_id', 'is_free', 'duration_minutes']);
        });
    }
};
