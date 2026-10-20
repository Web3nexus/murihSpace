<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Links a local session user to the MurihSpace account it signed in with.
 * Nullable: users created before "Continue with MurihSpace" have no link.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('murihspace_user_id')->nullable()->unique()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['murihspace_user_id']);
            $table->dropColumn('murihspace_user_id');
        });
    }
};
