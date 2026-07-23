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
        Schema::create('community_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('slug');
            $table->json('permissions');
            $table->boolean('is_system')->default(false);
            $table->string('color')->default('#38A8D8');
            $table->timestamps();

            $table->unique(['community_id', 'slug']);
        });

        // Add role_id to community_memberships table
        Schema::table('community_memberships', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->constrained('community_roles')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('community_memberships', function (Blueprint $table) {
            $table->dropForeign(['role_id']);
            $table->dropColumn('role_id');
        });

        Schema::dropIfExists('community_roles');
    }
};
