<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sla_policies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('priority')->index();
            $table->unsignedInteger('first_response_target')->comment('minutes');
            $table->unsignedInteger('next_response_target')->nullable()->comment('minutes');
            $table->unsignedInteger('resolution_target')->comment('minutes');
            $table->boolean('business_hours')->default(false)->comment('count only Mon–Fri within the configured window');
            $table->boolean('weekends')->default(false)->comment('count Saturday/Sunday when outside business hours');
            $table->boolean('holidays')->default(false)->comment('pause counting on holiday_dates');
            $table->json('holiday_dates')->nullable();
            $table->boolean('pause_on_customer')->default(false)->comment('pause SLA while waiting on the customer');
            $table->boolean('enabled')->default(true)->index();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['priority', 'enabled']);
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->timestamp('sla_paused_at')->nullable()->after('sla_policy_id');
            $table->unsignedInteger('sla_paused_seconds')->default(0)->after('sla_paused_at');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn(['sla_paused_at', 'sla_paused_seconds']);
        });

        Schema::dropIfExists('sla_policies');
    }
};
