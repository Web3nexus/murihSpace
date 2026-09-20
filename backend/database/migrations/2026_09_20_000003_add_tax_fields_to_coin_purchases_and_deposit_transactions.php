<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('coin_purchases', function (Blueprint $table) {
            $table->unsignedInteger('tax')->nullable()->after('amount_paid');
            $table->unsignedInteger('total_charged')->nullable()->after('tax');
            $table->decimal('tax_rate', 5, 2)->nullable()->after('total_charged');
            $table->char('tax_country_code', 3)->nullable()->after('tax_rate');
            $table->string('tax_type', 20)->nullable()->after('tax_country_code');
            $table->string('tax_name', 100)->nullable()->after('tax_type');
        });

        Schema::table('deposit_transactions', function (Blueprint $table) {
            $table->unsignedInteger('tax')->nullable()->after('net_amount');
            $table->unsignedInteger('total_charged')->nullable()->after('tax');
            $table->decimal('tax_rate', 5, 2)->nullable()->after('total_charged');
            $table->char('tax_country_code', 3)->nullable()->after('tax_rate');
            $table->string('tax_type', 20)->nullable()->after('tax_country_code');
            $table->string('tax_name', 100)->nullable()->after('tax_type');
        });
    }

    public function down(): void
    {
        Schema::table('coin_purchases', function (Blueprint $table) {
            $table->dropColumn(['tax', 'total_charged', 'tax_rate', 'tax_country_code', 'tax_type', 'tax_name']);
        });

        Schema::table('deposit_transactions', function (Blueprint $table) {
            $table->dropColumn(['tax', 'total_charged', 'tax_rate', 'tax_country_code', 'tax_type', 'tax_name']);
        });
    }
};