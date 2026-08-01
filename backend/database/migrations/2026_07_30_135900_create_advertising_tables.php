<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ad_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('objective');
            $table->string('status')->default('draft');
            $table->string('daily_budget')->nullable();
            $table->string('total_budget')->nullable();
            $table->timestamp('start_date')->nullable();
            $table->timestamp('end_date')->nullable();
            $table->json('targeting')->nullable();
            $table->json('placements')->nullable();
            $table->boolean('is_self_service')->default(true);
            $table->string('review_status')->default('pending');
            $table->text('review_notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('ad_creatives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained('ad_campaigns')->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->morphs('promotable');
            $table->string('headline', 255)->nullable();
            $table->text('description')->nullable();
            $table->string('cta_text', 100)->nullable();
            $table->string('destination_url', 500)->nullable();
            $table->string('media_url', 500)->nullable();
            $table->string('media_type')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('ad_analytics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained('ad_campaigns')->onDelete('cascade');
            $table->foreignId('creative_id')->nullable()->constrained('ad_creatives')->nullOnDelete();
            $table->date('date');
            $table->unsignedInteger('impressions')->default(0);
            $table->unsignedInteger('reach')->default(0);
            $table->unsignedInteger('clicks')->default(0);
            $table->unsignedInteger('reactions')->default(0);
            $table->unsignedInteger('comments')->default(0);
            $table->unsignedInteger('shares')->default(0);
            $table->unsignedInteger('follows')->default(0);
            $table->unsignedInteger('community_joins')->default(0);
            $table->unsignedInteger('product_views')->default(0);
            $table->unsignedInteger('purchases')->default(0);
            $table->unsignedInteger('messages_received')->default(0);
            $table->unsignedInteger('video_views')->default(0);
            $table->decimal('amount_spent', 12, 2)->default(0);
            $table->timestamps();
            $table->unique(['campaign_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ad_analytics');
        Schema::dropIfExists('ad_creatives');
        Schema::dropIfExists('ad_campaigns');
    }
};
