<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media', function (Blueprint $table) {
            if (! Schema::hasColumn('media', 'uuid')) {
                $table->uuid('uuid')->nullable()->unique()->after('id');
            }
            if (! Schema::hasColumn('media', 'owner_type')) {
                $table->string('owner_type')->nullable()->after('uuid');
                $table->unsignedBigInteger('owner_id')->nullable()->after('owner_type');
                $table->index(['owner_type', 'owner_id']);
            }
            if (! Schema::hasColumn('media', 'media_type')) {
                $table->string('media_type', 32)->default('image')->after('mime_type');
            }
            if (! Schema::hasColumn('media', 'processing_status')) {
                $table->string('processing_status', 32)->default('completed')->after('media_type');
                $table->index('processing_status');
            }
            if (! Schema::hasColumn('media', 'processing_error')) {
                $table->text('processing_error')->nullable()->after('processing_status');
            }
            if (! Schema::hasColumn('media', 'width')) {
                $table->unsignedInteger('width')->nullable()->after('size_bytes');
            }
            if (! Schema::hasColumn('media', 'height')) {
                $table->unsignedInteger('height')->nullable()->after('width');
            }
            if (! Schema::hasColumn('media', 'duration_seconds')) {
                $table->float('duration_seconds')->nullable()->after('height');
            }
            if (! Schema::hasColumn('media', 'thumbnail_path')) {
                $table->string('thumbnail_path')->nullable()->after('duration_seconds');
            }
            if (! Schema::hasColumn('media', 'hls_playlist_path')) {
                $table->string('hls_playlist_path')->nullable()->after('thumbnail_path');
            }
            if (! Schema::hasColumn('media', 'variants')) {
                $table->json('variants')->nullable()->after('hls_playlist_path');
            }
        });
    }

    public function down(): void
    {
        Schema::table('media', function (Blueprint $table) {
            $table->dropColumn([
                'uuid',
                'owner_type',
                'owner_id',
                'media_type',
                'processing_status',
                'processing_error',
                'width',
                'height',
                'duration_seconds',
                'thumbnail_path',
                'hls_playlist_path',
                'variants',
            ]);
        });
    }
};
