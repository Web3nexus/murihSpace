<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->unique()->nullable();
            $table->string('country')->nullable();
            $table->string('mobile_number')->nullable();
            $table->string('county')->nullable();
            $table->string('state')->nullable();
            $table->string('role')->default('member');
            $table->string('kyc_status')->default('pending');
            $table->string('kyc_document')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'username',
                'country',
                'mobile_number',
                'county',
                'state',
                'role',
                'kyc_status',
                'kyc_document'
            ]);
        });
    }
};
