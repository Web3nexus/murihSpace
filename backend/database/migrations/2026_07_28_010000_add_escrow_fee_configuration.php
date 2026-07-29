<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('fee_configurations')->insert([
            'fee_type' => 'escrow',
            'name' => 'Escrow Holding Fee',
            'percentage' => 1.00,
            'flat_fee' => 0,
            'currency' => 'NGN',
            'is_active' => true,
            'description' => 'Platform fee charged on escrow-held transactions',
        ]);
    }

    public function down(): void
    {
        DB::table('fee_configurations')->where('fee_type', 'escrow')->delete();
    }
};
