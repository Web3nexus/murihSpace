<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('username_trial_ends_at')->nullable()->after('username');
            $table->boolean('is_premium')->default(false)->after('username_trial_ends_at');
        });

        Schema::create('admin_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        DB::table('admin_settings')->insert([
            ['key' => 'free_username_trial_days', 'value' => '7'],
            ['key' => 'platform_name', 'value' => 'MurihSpace'],
        ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['username_trial_ends_at', 'is_premium']);
        });
        Schema::dropIfExists('admin_settings');
    }
};
