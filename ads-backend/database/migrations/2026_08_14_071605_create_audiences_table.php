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
        Schema::create('audiences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('advertiser_id')->constrained('advertisers')->onDelete('cascade');
            $table->string('name');
            $table->string('type'); // custom_list, lookalike, website_traffic
            $table->foreignId('source_audience_id')->nullable()->constrained('audiences')->nullOnDelete();
            $table->string('status')->default('ready'); // ready, processing
            $table->integer('size')->default(0);
            $table->jsonb('rules')->nullable(); // For dynamic audiences like website_traffic
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audiences');
    }
};
