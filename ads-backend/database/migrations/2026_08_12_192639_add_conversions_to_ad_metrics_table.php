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
        Schema::table('ad_metrics', function (Blueprint $table) {
            $table->integer('conversions')->default(0);
            $table->bigInteger('conversion_value')->default(0);
            $table->integer('follows')->default(0);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ad_metrics', function (Blueprint $table) {
            $table->dropColumn(['conversions', 'conversion_value', 'follows']);
        });
    }
};
