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
        Schema::table('link_in_bio_links', function (Blueprint $table) {
            $table->string('category')->nullable()->after('url'); // Service, Video, Booking, Resource
            $table->string('badge')->nullable()->after('category'); // Primary, Popular, Featured, Download
            $table->decimal('price', 10, 2)->nullable()->after('badge');
            $table->string('currency', 10)->default('$')->after('price');
            $table->string('icon_emoji', 30)->nullable()->after('currency');
            $table->string('icon_3d', 50)->nullable()->after('icon_emoji'); // bags, camera, calendar, box, etc.
            $table->bigInteger('unique_visitors')->default(0)->after('click_count');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('link_in_bio_links', function (Blueprint $table) {
            $table->dropColumn([
                'category',
                'badge',
                'price',
                'currency',
                'icon_emoji',
                'icon_3d',
                'unique_visitors',
            ]);
        });
    }
};
