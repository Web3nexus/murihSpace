<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('advertisers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('murihspace_user_id')->index();
            $table->string('business_name');
            $table->string('business_type')->nullable();
            $table->string('country');
            $table->string('currency');
            $table->string('timezone');
            $table->string('verification_status')->default('unverified');
            $table->string('risk_status')->default('normal');
            $table->string('account_status')->default('active');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('advertisers');
    }
};
