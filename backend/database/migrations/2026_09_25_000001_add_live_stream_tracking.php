<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('live_streams', function (Blueprint $table): void {
            $table->string('tracking_id', 36)->nullable()->unique();
        });

        $streams = DB::table('live_streams')
            ->whereNull('tracking_id')
            ->orderBy('id')
            ->get(['id']);

        foreach ($streams as $stream) {
            DB::table('live_streams')
                ->where('id', $stream->id)
                ->update(['tracking_id' => (string) Str::uuid()]);
        }

        Schema::create('live_stream_attributions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('live_stream_id')->constrained('live_streams')->cascadeOnDelete();
            $table->string('session_id', 128);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('device_session_id')->nullable()->constrained('device_sessions')->nullOnDelete();
            $table->string('source', 20)->default('web');
            $table->timestamp('first_seen_at')->useCurrent();
            $table->timestamp('last_seen_at')->useCurrent();
            $table->unsignedInteger('click_count')->default(0);
            $table->unsignedInteger('join_count')->default(0);
            $table->unsignedInteger('leave_count')->default(0);
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->text('referrer')->nullable();
            $table->string('utm_source', 100)->nullable();
            $table->string('utm_medium', 100)->nullable();
            $table->string('utm_campaign', 100)->nullable();
            $table->string('utm_content', 100)->nullable();
            $table->string('utm_term', 100)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();

            $table->unique(['live_stream_id', 'session_id'], 'live_stream_attribution_session_unique');
            $table->index(['live_stream_id', 'user_id']);
            $table->index(['live_stream_id', 'last_seen_at']);
            $table->index(['live_stream_id', 'source']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('live_stream_attributions');
        Schema::table('live_streams', function (Blueprint $table): void {
            $table->dropUnique(['tracking_id']);
            $table->dropColumn('tracking_id');
        });
    }
};
