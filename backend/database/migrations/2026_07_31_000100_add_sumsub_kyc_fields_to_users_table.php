<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('sumsub_applicant_id')->nullable()->after('kyc_document');
            $table->string('kyc_provider')->default('manual')->after('sumsub_applicant_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['sumsub_applicant_id', 'kyc_provider']);
        });
    }
};
