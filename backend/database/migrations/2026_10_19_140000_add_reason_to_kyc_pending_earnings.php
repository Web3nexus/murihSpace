<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Why the amount is held: `kyc` (identity not verified) or `review` (another order
        // of the seller is on hold or in dispute). Both release through the same sweep.
        Schema::table('kyc_pending_earnings', function (Blueprint $table) {
            $table->string('reason', 20)->default('kyc')->after('source');
        });
    }

    public function down(): void
    {
        Schema::table('kyc_pending_earnings', function (Blueprint $table) {
            $table->dropColumn('reason');
        });
    }
};
