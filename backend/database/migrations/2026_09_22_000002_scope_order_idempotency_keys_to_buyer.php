<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->unique(['buyer_id', 'idempotency_key']);
            $table->dropUnique(['idempotency_key']);
        });
    }

    public function down(): void
    {
        // Restoring the global unique index is only safe when no
        // cross-buyer duplicates exist. Refuse the rollback rather than
        // erasing valid idempotency history.
        $duplicates = DB::table('orders')
            ->whereNotNull('idempotency_key')
            ->groupBy('idempotency_key')
            ->havingRaw('COUNT(*) > 1')
            ->exists();

        if ($duplicates) {
            throw new \RuntimeException(
                'Cannot rollback: cross-buyer duplicate idempotency_key values exist in orders. Resolve conflicts before reverting this migration.'
            );
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['buyer_id', 'idempotency_key']);
            $table->unique('idempotency_key');
        });
    }
};