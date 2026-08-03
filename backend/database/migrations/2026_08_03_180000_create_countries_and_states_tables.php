<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('countries', function (Blueprint $table) {
            $table->string('iso2', 2)->primary();
            $table->string('iso3', 3)->nullable();
            $table->string('name');
            $table->string('calling_code', 20)->nullable();
            $table->string('flag', 10)->nullable(); // emoji flag
            $table->string('currency', 10)->nullable();
            $table->boolean('state_required')->default(false);
            $table->boolean('postal_code_required')->default(false);
            $table->timestamps();
        });

        Schema::create('states', function (Blueprint $table) {
            $table->id();
            $table->string('country_iso2', 2);
            $table->string('code', 50)->nullable();
            $table->string('name');
            $table->timestamps();

            $table->foreign('country_iso2')->references('iso2')->on('countries')->cascadeOnDelete();
            $table->index(['country_iso2', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('states');
        Schema::dropIfExists('countries');
    }
};
