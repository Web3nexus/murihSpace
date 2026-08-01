<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('storefronts', function (Blueprint $table) {
            $table->string('name')->nullable()->after('display_name');
            $table->string('currency', 3)->default('USD')->after('short_code');
            $table->decimal('tax_rate', 5, 2)->default(0)->after('currency');
            $table->text('shipping_policy')->nullable()->after('links');
            $table->text('return_policy')->nullable()->after('shipping_policy');
        });
    }

    public function down(): void
    {
        Schema::table('storefronts', function (Blueprint $table) {
            $table->dropColumn(['name', 'currency', 'tax_rate', 'shipping_policy', 'return_policy']);
        });
    }
};
