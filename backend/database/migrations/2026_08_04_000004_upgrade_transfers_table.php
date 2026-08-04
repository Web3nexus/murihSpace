<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transfers', function (Blueprint $table) {
            $table->string('from_wallet_type', 20)->default('system')->after('sender_id');
            $table->string('to_wallet_type', 20)->default('system')->after('recipient_id');
            $table->bigInteger('fee_amount')->default(0)->after('amount');
            $table->string('idempotency_key', 100)->nullable()->unique()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('transfers', function (Blueprint $table) {
            $table->dropUnique(['idempotency_key']);
            $table->dropColumn(['from_wallet_type', 'to_wallet_type', 'fee_amount', 'idempotency_key']);
        });
    }
};
