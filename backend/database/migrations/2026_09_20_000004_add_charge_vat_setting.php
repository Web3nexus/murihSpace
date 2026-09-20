<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Global VAT master toggle used by TaxCalculationService. Disabling it stops
        // the platform from charging/collecting VAT on coin purchases & top-ups.
        DB::table('admin_settings')->insertOrIgnore([
            ['key' => 'charge_vat', 'value' => '1'],
        ]);
    }

    public function down(): void
    {
        DB::table('admin_settings')->where('key', 'charge_vat')->delete();
    }
};