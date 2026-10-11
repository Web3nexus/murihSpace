<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('live_streams', function (Blueprint $table) {
            // Physical and digital products live in separate tables, so a bare
            // numeric pinned_product_id is ambiguous when the same id exists in
            // both. Store the type alongside the id to resolve it deterministically.
            $table->string('pinned_product_type')->nullable()->after('pinned_product_id');
        });
    }

    public function down(): void
    {
        Schema::table('live_streams', function (Blueprint $table) {
            $table->dropColumn('pinned_product_type');
        });
    }
};
