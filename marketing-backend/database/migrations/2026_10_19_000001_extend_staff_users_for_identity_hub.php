<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Turns staff_users into the identity hub record: an explicit active/disabled
 * status, optional two-factor fields, and lockout bookkeeping.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff_users', function (Blueprint $table) {
            $table->string('status', 16)->default('active')->after('role');
            $table->text('two_factor_secret')->nullable()->after('password');
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_secret');
            $table->unsignedSmallInteger('failed_login_attempts')->default(0)->after('last_login_ip');
            $table->timestamp('locked_until')->nullable()->after('failed_login_attempts');
            $table->index('status');
        });

        DB::table('staff_users')->where('is_active', false)->update(['status' => 'disabled']);
    }

    public function down(): void
    {
        Schema::table('staff_users', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn([
                'status',
                'two_factor_secret',
                'two_factor_confirmed_at',
                'failed_login_attempts',
                'locked_until',
            ]);
        });
    }
};
