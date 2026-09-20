<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Custom (manual amount) purchases are not tied to a predefined pack.
        Schema::table('coin_purchases', function (Blueprint $table) {
            $table->foreignId('coin_pack_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('coin_purchases', function (Blueprint $table) {
            $table->foreignId('coin_pack_id')->nullable(false)->change();
        });
    }
};