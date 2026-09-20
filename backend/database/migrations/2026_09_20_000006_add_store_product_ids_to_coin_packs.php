<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('coin_packs', function (Blueprint $table) {
            $table->string('store_product_ios')->nullable()->after('badge');
            $table->string('store_product_android')->nullable()->after('store_product_ios');
        });
    }

    public function down(): void
    {
        Schema::table('coin_packs', function (Blueprint $table) {
            $table->dropColumn(['store_product_ios', 'store_product_android']);
        });
    }
};