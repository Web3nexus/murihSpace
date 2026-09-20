<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('admin_settings')->insertOrIgnore([
            ['key' => 'web_purchases_enabled', 'value' => '1'],
        ]);
    }

    public function down(): void
    {
        DB::table('admin_settings')->where('key', 'web_purchases_enabled')->delete();
    }
};