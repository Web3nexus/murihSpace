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
        Schema::create('ad_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained('campaigns')->onDelete('cascade');
            $table->string('name');
            $table->jsonb('audience_targeting')->nullable();
            $table->jsonb('placements')->nullable();
            $table->string('optimization_goal')->nullable();
            $table->string('bid_strategy')->nullable();
            $table->bigInteger('bid_amount')->nullable();
            $table->string('budget_type')->nullable();
            $table->bigInteger('budget_amount')->nullable();
            $table->string('status')->default('active');
            $table->timestamp('start_time')->nullable();
            $table->timestamp('end_time')->nullable();
            $table->integer('frequency_cap')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ad_groups');
    }
};
