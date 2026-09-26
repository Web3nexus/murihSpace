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
        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'avatar_url')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('avatar_url')->nullable()->after('avatar');
            });
        }

        if (Schema::hasTable('communities')) {
            Schema::table('communities', function (Blueprint $table) {
                if (! Schema::hasColumn('communities', 'avatar')) {
                    $table->string('avatar')->nullable()->after('logo_url');
                }
                if (! Schema::hasColumn('communities', 'avatar_url')) {
                    $table->string('avatar_url')->nullable()->after('avatar');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'avatar_url')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('avatar_url');
            });
        }

        if (Schema::hasTable('communities')) {
            Schema::table('communities', function (Blueprint $table) {
                $columns = [];
                if (Schema::hasColumn('communities', 'avatar')) {
                    $columns[] = 'avatar';
                }
                if (Schema::hasColumn('communities', 'avatar_url')) {
                    $columns[] = 'avatar_url';
                }
                if (! empty($columns)) {
                    $table->dropColumn($columns);
                }
            });
        }
    }
};
