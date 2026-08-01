<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            $table->string('media_url')->nullable()->change();
        });

        DB::table('admin_settings')->insertOrIgnore([
            ['key' => 'story_type_image_enabled', 'value' => '1'],
            ['key' => 'story_type_text_enabled', 'value' => '1'],
            ['key' => 'story_type_video_enabled', 'value' => '1'],
        ]);
    }

    public function down(): void
    {
        DB::table('admin_settings')
            ->whereIn('key', ['story_type_image_enabled', 'story_type_text_enabled', 'story_type_video_enabled'])
            ->delete();
    }
};
