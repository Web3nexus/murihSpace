<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('admin_role')->nullable()->after('role');
            $table->json('admin_permissions')->nullable()->after('admin_role');
        });

        DB::table('users')->where('role', 'admin')->whereNull('admin_role')->update(['admin_role' => 'super_admin']);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['admin_role', 'admin_permissions']);
        });
    }
};
