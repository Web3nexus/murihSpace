<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media', function (Blueprint $table) {
            $table->timestamp('delete_after')->nullable()->after('last_referenced_at');
            $table->string('lifecycle_status', 30)->default('available')->index();
            $table->string('retention_hold', 30)->nullable();
            $table->timestamp('held_until')->nullable();
            $table->timestamp('expired_at')->nullable();
        });

        // Explicit retention holds (dispute, order, legal, reconciliation, business rule, malware review).
        Schema::create('media_retention_holds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('media_id')->constrained()->cascadeOnDelete();
            $table->string('hold_type', 30);
            $table->string('reason', 500)->nullable();
            $table->string('case_ref', 100)->nullable();
            $table->foreignId('placed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('expires_at')->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamps();

            $table->index(['media_id', 'status']);
        });

        // Immutable audit trail for retention lifecycle transitions.
        Schema::create('media_retention_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('media_id')->constrained()->cascadeOnDelete();
            $table->foreignId('message_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event', 30);
            $table->string('reason', 500)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('media_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_retention_logs');
        Schema::dropIfExists('media_retention_holds');

        Schema::table('media', function (Blueprint $table) {
            $table->dropColumn(['delete_after', 'lifecycle_status', 'retention_hold', 'held_until', 'expired_at']);
        });
    }
};
