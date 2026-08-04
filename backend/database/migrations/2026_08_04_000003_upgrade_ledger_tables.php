<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── ledger_transactions: add idempotency_key + status ─────────────────
        Schema::table('ledger_transactions', function (Blueprint $table) {
            $table->string('idempotency_key', 100)->nullable()->unique()->after('ulid');
            $table->string('status', 20)->default('completed')->after('type'); // pending|completed|reversed
            $table->foreignId('initiated_by')->nullable()->constrained('users')->nullOnDelete()->after('status');
        });

        // ── ledger_entries: add wallet_type, balance_category ─────────────────
        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->string('wallet_type', 20)->default('system')->after('account_type');
            $table->string('balance_category', 30)->default('available')->after('wallet_type'); // available|pending|reserved|…
        });
    }

    public function down(): void
    {
        Schema::table('ledger_transactions', function (Blueprint $table) {
            $table->dropUnique(['idempotency_key']);
            $table->dropColumn(['idempotency_key', 'status', 'initiated_by']);
        });

        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->dropColumn(['wallet_type', 'balance_category']);
        });
    }
};
