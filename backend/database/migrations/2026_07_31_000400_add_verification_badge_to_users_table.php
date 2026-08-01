<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('verification_badge_status')->default('none')->after('kyc_provider');
            $table->timestamp('verification_badge_expires_at')->nullable()->after('verification_badge_status');
            $table->timestamp('verification_badge_purchased_at')->nullable()->after('verification_badge_expires_at');
            $table->boolean('verification_badge_auto_renew')->default(false)->after('verification_badge_purchased_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'verification_badge_status',
                'verification_badge_expires_at',
                'verification_badge_purchased_at',
                'verification_badge_auto_renew',
            ]);
        });
    }
};
