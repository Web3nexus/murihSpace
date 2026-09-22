<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fulfilment_orders', function (Blueprint $table) {
            $table->string('idempotency_key', 128)->nullable()->after('order_number');
            $table->unique(['buyer_id', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::table('fulfilment_orders', function (Blueprint $table) {
            $table->dropUnique(['buyer_id', 'idempotency_key']);
            $table->dropColumn('idempotency_key');
        });
    }
};