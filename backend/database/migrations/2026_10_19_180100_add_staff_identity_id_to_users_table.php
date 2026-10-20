<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Stable id of the staff record in the marketing backend (the staff login).
            $table->string('staff_identity_id', 191)->nullable()->unique()->after('admin_permissions');
            // Synced staff sign in through the marketing backend, so they hold no password here.
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['staff_identity_id']);
            $table->dropColumn('staff_identity_id');
        });
    }
};
