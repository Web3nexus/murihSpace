<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A provider transfer is tied to the withdrawal it pays out. The unique index means a withdrawal
     * can never have two provider transfers, which is the database-level guard against paying twice.
     */
    public function up(): void
    {
        Schema::table('payouts', function (Blueprint $table) {
            $table->unsignedBigInteger('withdrawal_request_id')->nullable()->after('payout_destination_id');
            $table->unsignedSmallInteger('dispatch_attempts')->default(0)->after('dispatched_at');
            $table->text('dispatch_error')->nullable()->after('dispatch_attempts');
        });

        Schema::table('payouts', function (Blueprint $table) {
            $table->unique('withdrawal_request_id');
        });
    }

    public function down(): void
    {
        Schema::table('payouts', function (Blueprint $table) {
            $table->dropUnique(['withdrawal_request_id']);
            $table->dropColumn(['withdrawal_request_id', 'dispatch_attempts', 'dispatch_error']);
        });
    }
};
