<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('escrows', function (Blueprint $table) {
            $table->string('delivery_kind', 20)->nullable()->after('status');   // digital | physical
            $table->timestamp('delivered_at')->nullable()->after('delivery_kind');
            $table->timestamp('buyer_confirmed_at')->nullable()->after('delivered_at');
            $table->timestamp('release_at')->nullable()->index()->after('buyer_confirmed_at');
            $table->timestamp('held_at')->nullable()->after('release_at');
            $table->string('hold_reason', 191)->nullable()->after('held_at');
            $table->timestamp('reminder_sent_at')->nullable()->after('hold_reason');
            $table->timestamp('delivery_alert_at')->nullable()->after('reminder_sent_at');
        });

        // Existing held escrows get the no-delivery check date, so the hourly job
        // can review them. Nothing is refunded by this migration.
        DB::table('escrows')
            ->where('status', 'held')
            ->whereNull('release_at')
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $row) {
                    // A physical order already delivered takes its delivery date, so the
                    // hourly job does not freeze it as "no delivery".
                    $deliveredAt = $row->fulfilment_order_id
                        ? DB::table('fulfilment_orders')->where('id', $row->fulfilment_order_id)->value('delivered_at')
                        : null;

                    DB::table('escrows')->where('id', $row->id)->update([
                        'delivery_kind' => $deliveredAt ? 'physical' : null,
                        'delivered_at' => $deliveredAt,
                        'release_at' => $deliveredAt
                            ? \Illuminate\Support\Carbon::parse($deliveredAt)->addDays(10)
                            : \Illuminate\Support\Carbon::parse($row->created_at)->addDays(14),
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('escrows', function (Blueprint $table) {
            $table->dropIndex(['release_at']);
            $table->dropColumn([
                'delivery_kind', 'delivered_at', 'buyer_confirmed_at', 'release_at',
                'held_at', 'hold_reason', 'reminder_sent_at', 'delivery_alert_at',
            ]);
        });
    }
};
