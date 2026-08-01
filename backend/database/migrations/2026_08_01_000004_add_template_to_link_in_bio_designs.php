<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('link_in_bio_designs', function (Blueprint $table) {
            $table->string('template')->default('minimal')->after('layout');
        });
    }

    public function down(): void
    {
        Schema::table('link_in_bio_designs', function (Blueprint $table) {
            $table->dropColumn('template');
        });
    }
};
