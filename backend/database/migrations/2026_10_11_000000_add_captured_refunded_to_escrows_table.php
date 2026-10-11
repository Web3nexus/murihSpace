<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('escrows', function (Blueprint $table) {
            $table->dateTime('captured_at')->nullable()->after('released_at');
            $table->dateTime('refunded_at')->nullable()->after('captured_at');
        });
    }

    public function down(): void
    {
        Schema::table('escrows', function (Blueprint $table) {
            $table->dropColumn(['captured_at', 'refunded_at']);
        });
    }
};
