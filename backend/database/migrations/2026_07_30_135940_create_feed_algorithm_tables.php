<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feed_weights', function (Blueprint $table) {
            $table->id();
            $table->string('feed_type')->default('home');
            $table->string('signal_name', 100);
            $table->decimal('weight', 8, 4)->default(1.0000);
            $table->boolean('is_active')->default(true);
            $table->string('label', 255)->nullable();
            $table->text('description')->nullable();
            $table->string('group', 50)->nullable();
            $table->timestamps();
            $table->unique(['feed_type', 'signal_name']);
        });

        Schema::create('feed_algorithm_configs', function (Blueprint $table) {
            $table->id();
            $table->string('feed_type', 50)->unique();
            $table->string('label', 255);
            $table->text('description')->nullable();
            $table->json('config')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('stage')->default('production');
            $table->timestamps();
        });

        Schema::create('feed_algorithm_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('users')->onDelete('cascade');
            $table->string('action');
            $table->string('feed_type', 50)->nullable();
            $table->string('signal_name', 100)->nullable();
            $table->decimal('previous_weight', 8, 4)->nullable();
            $table->decimal('new_weight', 8, 4)->nullable();
            $table->boolean('previous_active')->nullable();
            $table->boolean('new_active')->nullable();
            $table->morphs('subject');
            $table->text('reason')->nullable();
            $table->boolean('is_temporary')->default(false);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('feed_boosts', function (Blueprint $table) {
            $table->id();
            $table->morphs('boostable');
            $table->decimal('boost_factor', 5, 2)->default(1.00);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('admin_id')->constrained('users')->onDelete('cascade');
            $table->text('reason')->nullable();
            $table->timestamps();
        });

        Schema::create('feed_ab_tests', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->string('feed_type', 50);
            $table->json('control_config');
            $table->json('variant_config');
            $table->unsignedInteger('traffic_percentage')->default(50);
            $table->string('status')->default('draft');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feed_ab_tests');
        Schema::dropIfExists('feed_boosts');
        Schema::dropIfExists('feed_algorithm_changes');
        Schema::dropIfExists('feed_algorithm_configs');
        Schema::dropIfExists('feed_weights');
    }
};
