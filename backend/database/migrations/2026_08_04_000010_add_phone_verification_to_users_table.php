<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Email becomes optional for phone-first registrations. Users who sign
        // up through the phone-OTP flow may not have an email address.
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->timestamp('phone_verified_at')->nullable()->after('email_verified_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('phone_verified_at');
            $table->string('email')->nullable(false)->change();
        });
    }
};
