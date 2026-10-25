<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Why the account is suspended: 'manual', 'auto_reports', or 'appeal_rejected' (after a banned appeal).
            $table->string('suspension_source', 30)->nullable()->after('suspension_reason');
        });

        Schema::create('account_appeals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('message');
            $table->string('status', 20)->default('pending')->index(); // pending | approved | rejected
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_appeals');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('suspension_source');
        });
    }
};
