<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Standard peg: 10 MSH coins = $1.00 USD. Admins can tune this value.
        DB::table('admin_settings')->insertOrIgnore([
            ['key' => 'coin_conversion_rate', 'value' => '10'],
            ['key' => 'coin_min_purchase_usd', 'value' => '1'],
            ['key' => 'coin_max_purchase_usd', 'value' => '10000'],
        ]);
    }

    public function down(): void
    {
        DB::table('admin_settings')
            ->whereIn('key', ['coin_conversion_rate', 'coin_min_purchase_usd', 'coin_max_purchase_usd'])
            ->delete();
    }
};