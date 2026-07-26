<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('referral_programs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('is_active')->default(true);
            $table->string('reward_type')->default('percentage');
            $table->unsignedInteger('reward_value')->default(10);
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('referral_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('referral_program_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code', 50)->unique();
            $table->unsignedInteger('clicks')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['creator_id', 'is_active']);
        });

        Schema::create('referrals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referral_link_id')->constrained()->cascadeOnDelete();
            $table->foreignId('referred_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type');
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->unsignedInteger('reward_amount')->nullable();
            $table->boolean('reward_paid')->default(false);
            $table->timestamp('converted_at')->nullable();
            $table->timestamps();

            $table->index(['referral_link_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referrals');
        Schema::dropIfExists('referral_links');
        Schema::dropIfExists('referral_programs');
    }
};
