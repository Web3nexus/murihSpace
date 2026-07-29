<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('link_in_bio_designs', function (Blueprint $table) {
            $table->foreignId('theme_id')->nullable()->after('user_id')->constrained('link_in_bio_themes')->nullOnDelete();
            $table->string('profile_name')->nullable()->after('theme_id');
            $table->text('profile_bio')->nullable()->after('profile_name');
            $table->string('avatar_url')->nullable()->after('profile_bio');
            $table->string('font')->default('sans')->after('avatar_url');
            $table->string('button_style')->default('rounded')->after('font');
            $table->string('layout')->default('list')->after('button_style');
            $table->string('background_type')->default('solid')->after('layout');
            $table->string('background_value')->nullable()->after('background_type');
        });
    }

    public function down(): void
    {
        Schema::table('link_in_bio_designs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('theme_id');
            $table->dropColumn(['profile_name', 'profile_bio', 'avatar_url', 'font', 'button_style', 'layout', 'background_type', 'background_value']);
        });
    }
};
