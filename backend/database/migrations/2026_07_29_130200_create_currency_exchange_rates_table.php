<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('currency_exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->char('from_currency', 3);
            $table->char('to_currency', 3);
            $table->decimal('rate', 12, 6);
            $table->timestamp('updated_at')->useCurrent();

            $table->unique(['from_currency', 'to_currency']);
        });

        DB::table('currency_exchange_rates')->insert([
            ['from_currency' => 'NGN', 'to_currency' => 'USD', 'rate' => 0.000667],
            ['from_currency' => 'USD', 'to_currency' => 'NGN', 'rate' => 1500.000000],
            ['from_currency' => 'NGN', 'to_currency' => 'GBP', 'rate' => 0.000526],
            ['from_currency' => 'GBP', 'to_currency' => 'NGN', 'rate' => 1900.000000],
            ['from_currency' => 'NGN', 'to_currency' => 'EUR', 'rate' => 0.000615],
            ['from_currency' => 'EUR', 'to_currency' => 'NGN', 'rate' => 1625.000000],
            ['from_currency' => 'USD', 'to_currency' => 'GBP', 'rate' => 0.789000],
            ['from_currency' => 'GBP', 'to_currency' => 'USD', 'rate' => 1.267000],
            ['from_currency' => 'USD', 'to_currency' => 'EUR', 'rate' => 0.923000],
            ['from_currency' => 'EUR', 'to_currency' => 'USD', 'rate' => 1.083000],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('currency_exchange_rates');
    }
};
