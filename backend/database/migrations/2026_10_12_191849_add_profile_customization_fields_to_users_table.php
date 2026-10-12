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
        Schema::table('users', function (Blueprint $table) {
            $table->string('website', 512)->nullable()->after('bio');
            $table->string('gender', 50)->nullable()->after('birthday');
            $table->string('category', 100)->nullable()->after('website');
            $table->json('interests')->nullable()->after('category');
            $table->json('languages')->nullable()->after('interests');
            $table->boolean('is_creator_account')->default(true)->after('languages');
            $table->boolean('show_interests')->default(true)->after('is_creator_account');
            $table->boolean('allow_tagging')->default(true)->after('show_interests');
            $table->boolean('show_contact_info')->default(true)->after('allow_tagging');
            $table->string('account_privacy', 50)->default('public')->after('show_contact_info');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'website',
                'gender',
                'category',
                'interests',
                'languages',
                'is_creator_account',
                'show_interests',
                'allow_tagging',
                'show_contact_info',
                'account_privacy',
            ]);
        });
    }
};
