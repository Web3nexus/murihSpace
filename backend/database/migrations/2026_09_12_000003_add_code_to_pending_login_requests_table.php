<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pending_login_requests', function (Blueprint $table) {
            $table->string('verification_code_hash', 64)->nullable()->after('request_token');
            $table->unsignedTinyInteger('attempts')->default(0)->after('verification_code_hash');
            $table->string('delivery_channel', 40)->default('in_app_active_device')->after('attempts');
        });
    }

    public function down(): void
    {
        Schema::table('pending_login_requests', function (Blueprint $table) {
            $table->dropColumn(['verification_code_hash', 'attempts', 'delivery_channel']);
        });
    }
};

