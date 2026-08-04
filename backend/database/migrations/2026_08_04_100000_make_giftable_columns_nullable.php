<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gift_transactions', function (Blueprint $table) {
            $table->string('giftable_type')->nullable()->change();
            $table->unsignedBigInteger('giftable_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('gift_transactions', function (Blueprint $table) {
            $table->string('giftable_type')->nullable(false)->change();
            $table->unsignedBigInteger('giftable_id')->nullable(false)->change();
        });
    }
};
