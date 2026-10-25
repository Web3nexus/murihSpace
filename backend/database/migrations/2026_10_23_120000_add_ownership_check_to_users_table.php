<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('ownership_session_id')->nullable();
            $table->timestamp('ownership_confirmed_at')->nullable();
            // The sign-in (access token) that completed the check. Each login must confirm for itself.
            $table->unsignedBigInteger('ownership_token_id')->nullable();
            // Set when the verification was imported from another app. Those accounts
            // must confirm ownership before moving money.
            $table->boolean('requires_ownership_check')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['ownership_session_id', 'ownership_confirmed_at', 'ownership_token_id', 'requires_ownership_check']);
        });
    }
};
