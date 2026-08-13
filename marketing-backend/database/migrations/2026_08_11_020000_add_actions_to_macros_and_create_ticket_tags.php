<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('macros', function (Blueprint $table) {
            $table->json('actions')->nullable()->after('body');
        });

        Schema::create('ticket_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('tickets')->cascadeOnDelete();
            $table->string('name', 100);
            $table->timestamps();

            $table->unique(['ticket_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_tags');

        Schema::table('macros', function (Blueprint $table) {
            $table->dropColumn('actions');
        });
    }
};
