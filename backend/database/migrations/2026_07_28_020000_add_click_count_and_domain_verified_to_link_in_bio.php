<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('link_in_bio_links', function (Blueprint $table) {
            $table->bigInteger('click_count')->default(0)->after('is_active');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('domain_verified_at')->nullable()->after('link_in_bio_url');
        });
    }

    public function down(): void
    {
        Schema::table('link_in_bio_links', function (Blueprint $table) {
            $table->dropColumn('click_count');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('domain_verified_at');
        });
    }
};
