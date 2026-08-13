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
        Schema::create('ad_account_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ad_account_id')->constrained('ad_accounts')->onDelete('cascade');
            $table->unsignedBigInteger('murihspace_user_id')->index();
            $table->string('role'); // owner, admin, campaign_manager, etc.
            $table->timestamps();

            $table->unique(['ad_account_id', 'murihspace_user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ad_account_members');
    }
};
