<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Drop the old single-balance unique constraint and balance column ──
        Schema::table('wallets', function (Blueprint $table) {
            // Drop old unique index on user_id alone
            $table->dropUnique(['user_id']);
        });

        Schema::table('wallets', function (Blueprint $table) {
            // Add wallet_type before renaming balance
            $table->string('wallet_type', 20)->default('system')->after('user_id');
        });

        // Migrate existing balance → available (integer minor units already)
        DB::statement('UPDATE wallets SET wallet_type = \'system\'');

        Schema::table('wallets', function (Blueprint $table) {
            // Add granular balance categories
            $table->bigInteger('available')->default(0)->after('wallet_type');
            $table->bigInteger('pending')->default(0)->after('available');
            $table->bigInteger('reserved')->default(0)->after('pending');
            $table->bigInteger('escrow')->default(0)->after('reserved');
            $table->bigInteger('withdrawable')->default(0)->after('escrow');
            $table->bigInteger('non_withdrawable')->default(0)->after('withdrawable');
            $table->bigInteger('disputed')->default(0)->after('non_withdrawable');
        });

        // Copy legacy balance into available
        DB::statement('UPDATE wallets SET available = balance');

        Schema::table('wallets', function (Blueprint $table) {
            // Drop old single balance column
            $table->dropColumn('balance');
            // Composite unique: one wallet per (user, type)
            $table->unique(['user_id', 'wallet_type']);
        });
    }

    public function down(): void
    {
        Schema::table('wallets', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'wallet_type']);
            $table->bigInteger('balance')->default(0)->after('user_id');
        });

        DB::statement('UPDATE wallets SET balance = available');

        Schema::table('wallets', function (Blueprint $table) {
            $table->dropColumn([
                'wallet_type', 'available', 'pending', 'reserved',
                'escrow', 'withdrawable', 'non_withdrawable', 'disputed',
            ]);
            $table->unique(['user_id']);
        });
    }
};
