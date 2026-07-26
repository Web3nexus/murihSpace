<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('logo_url')->nullable();
            $table->string('website')->nullable();
            $table->text('description')->nullable();
            $table->string('industry')->nullable();
            $table->string('contact_email')->nullable();
            $table->boolean('is_approved')->default(false);
            $table->timestamps();
        });

        Schema::create('media_kits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->text('bio')->nullable();
            $table->string('profile_image_url')->nullable();
            $table->json('audience_demographics')->nullable();
            $table->decimal('engagement_rate', 5, 2)->nullable();
            $table->unsignedInteger('total_followers')->default(0);
            $table->unsignedInteger('avg_views')->default(0);
            $table->json('top_content')->nullable();
            $table->json('past_partnerships')->nullable();
            $table->json('rate_card')->nullable();
            $table->boolean('is_published')->default(false);
            $table->timestamps();

            $table->unique(['creator_id']);
        });

        Schema::create('brand_deals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('deal_type')->default('sponsored_post');
            $table->string('status')->default('pending');
            $table->unsignedInteger('budget')->default(0);
            $table->string('currency', 3)->default('NGN');
            $table->text('deliverables')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();

            $table->index(['creator_id', 'status']);
            $table->index(['brand_id', 'status']);
        });

        Schema::create('brand_deal_proposals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->string('brand_name')->nullable();
            $table->string('brand_email')->nullable();
            $table->string('title');
            $table->text('pitch');
            $table->unsignedInteger('proposed_budget')->nullable();
            $table->string('currency', 3)->default('NGN');
            $table->text('deliverables')->nullable();
            $table->string('status')->default('draft');
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['creator_id', 'status']);
        });

        Schema::create('brand_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('brand_deal_id')->nullable()->constrained()->nullOnDelete();
            $table->string('brand_name');
            $table->string('brand_email')->nullable();
            $table->string('invoice_number')->unique();
            $table->unsignedInteger('amount');
            $table->string('currency', 3)->default('NGN');
            $table->text('description')->nullable();
            $table->string('status')->default('draft');
            $table->date('due_date')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['creator_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('brand_invoices');
        Schema::dropIfExists('brand_deal_proposals');
        Schema::dropIfExists('brand_deals');
        Schema::dropIfExists('media_kits');
        Schema::dropIfExists('brands');
    }
};
