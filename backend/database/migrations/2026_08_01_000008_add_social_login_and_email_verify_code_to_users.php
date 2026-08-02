<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add social login identifiers and email verification code columns.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('provider')->nullable()->index()->after('status');
            $table->string('provider_id')->nullable()->index()->after('provider');
            $table->string('email_verify_code_hash')->nullable()->after('email_verified_at');
            $table->timestamp('email_verify_code_expires_at')->nullable()->after('email_verify_code_hash');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['provider', 'provider_id', 'email_verify_code_hash', 'email_verify_code_expires_at']);
        });
    }
};
