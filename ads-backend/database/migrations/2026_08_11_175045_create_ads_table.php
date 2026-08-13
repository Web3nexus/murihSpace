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
        Schema::create('ads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ad_group_id')->constrained('ad_groups')->onDelete('cascade');
            $table->string('name');
            $table->string('promoted_object_type')->nullable();
            $table->unsignedBigInteger('promoted_object_id')->nullable();
            $table->unsignedBigInteger('creative_id')->nullable(); // We'll add FK later if needed
            $table->string('headline')->nullable();
            $table->text('body')->nullable();
            $table->string('cta_type')->nullable();
            $table->string('destination_url')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ads');
    }
};
