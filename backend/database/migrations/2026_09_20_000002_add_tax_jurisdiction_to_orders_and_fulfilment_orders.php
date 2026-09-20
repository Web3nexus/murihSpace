<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add country jurisdiction + tax type metadata to commerce orders so that
     * checkout VAT can be reconstructed and attributed per country for filing.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('tax_country_code', 3)->nullable()->after('tax_rate');
            $table->string('tax_type', 30)->nullable()->after('tax_country_code');
            $table->string('tax_name', 100)->nullable()->after('tax_type');
            $table->index('tax_country_code');
        });

        Schema::table('fulfilment_orders', function (Blueprint $table) {
            $table->unsignedBigInteger('tax')->default(0)->after('platform_fee');
            $table->decimal('tax_rate', 5, 2)->default(0)->after('tax');
            $table->string('tax_country_code', 3)->nullable()->after('tax_rate');
            $table->string('tax_type', 30)->nullable()->after('tax_country_code');
            $table->index('tax_country_code');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['tax_country_code']);
            $table->dropColumn(['tax_country_code', 'tax_type', 'tax_name']);
        });

        Schema::table('fulfilment_orders', function (Blueprint $table) {
            $table->dropIndex(['tax_country_code']);
            $table->dropColumn(['tax', 'tax_rate', 'tax_country_code', 'tax_type']);
        });
    }
};