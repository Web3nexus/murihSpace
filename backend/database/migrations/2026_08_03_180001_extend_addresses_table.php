<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('addresses', function (Blueprint $table) {
            $table->string('administrative_area_level_1')->nullable()->after('state');
            $table->string('administrative_area_level_2')->nullable()->after('administrative_area_level_1');
            $table->decimal('latitude', 10, 7)->nullable()->after('administrative_area_level_2');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
        });
    }

    public function down(): void
    {
        Schema::table('addresses', function (Blueprint $table) {
            $table->dropColumn(['administrative_area_level_1', 'administrative_area_level_2', 'latitude', 'longitude']);
        });
    }
};
