<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gifts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('icon_url', 500)->nullable();
            $table->string('animation_url', 500)->nullable();
            $table->unsignedInteger('coin_price');
            $table->unsignedInteger('creator_earns');
            $table->unsignedInteger('platform_commission');
            $table->string('category', 50)->default('standard');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('gift_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sender_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('recipient_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('gift_id')->constrained()->onDelete('cascade');
            $table->morphs('giftable');
            $table->unsignedInteger('coin_price');
            $table->unsignedInteger('creator_earns');
            $table->unsignedInteger('platform_commission');
            $table->string('currency', 10)->default('MSH');
            $table->string('status')->default('completed');
            $table->boolean('is_anonymous')->default(false);
            $table->string('sender_display_name', 100)->nullable();
            $table->text('message')->nullable();
            $table->boolean('is_public')->default(true);
            $table->string('idempotency_key', 100)->unique()->nullable();
            $table->timestamps();
        });

        Schema::create('creator_wallet', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->onDelete('cascade');
            $table->unsignedInteger('total_gifts_received')->default(0);
            $table->decimal('gross_earnings', 12, 2)->default(0);
            $table->decimal('platform_fees', 12, 2)->default(0);
            $table->decimal('net_earnings', 12, 2)->default(0);
            $table->decimal('pending_balance', 12, 2)->default(0);
            $table->decimal('available_balance', 12, 2)->default(0);
            $table->decimal('withdrawn_balance', 12, 2)->default(0);
            $table->string('status')->default('active');
            $table->boolean('gifting_enabled')->default(true);
            $table->timestamps();
        });

        Schema::create('creator_payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->decimal('amount', 12, 2);
            $table->decimal('platform_fee', 12, 2)->default(0);
            $table->decimal('net_amount', 12, 2);
            $table->string('payment_method', 50)->nullable();
            $table->string('payment_details', 500)->nullable();
            $table->string('status')->default('pending');
            $table->text('admin_notes')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('idempotency_key', 100)->unique()->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('creator_payouts');
        Schema::dropIfExists('creator_wallet');
        Schema::dropIfExists('gift_transactions');
        Schema::dropIfExists('gifts');
    }
};
