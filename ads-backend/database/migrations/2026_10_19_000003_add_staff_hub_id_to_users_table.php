<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Links an ads staff account to the marketing hub staff id it signed in with.
 * Nullable: advertisers and legacy rows have no staff identity.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('staff_hub_id')->nullable()->unique()->after('murihspace_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['staff_hub_id']);
            $table->dropColumn('staff_hub_id');
        });
    }
};
