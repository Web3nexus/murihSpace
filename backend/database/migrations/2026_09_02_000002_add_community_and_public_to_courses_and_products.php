<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('courses')) {
            Schema::table('courses', function (Blueprint $table) {
                if (!Schema::hasColumn('courses', 'community_id')) {
                    $table->foreignId('community_id')->nullable()->constrained('communities')->nullOnDelete();
                }
                if (!Schema::hasColumn('courses', 'is_public')) {
                    $table->boolean('is_public')->default(true);
                }
            });
        }

        if (Schema::hasTable('digital_products')) {
            Schema::table('digital_products', function (Blueprint $table) {
                if (!Schema::hasColumn('digital_products', 'community_id')) {
                    $table->foreignId('community_id')->nullable()->constrained('communities')->nullOnDelete();
                }
                if (!Schema::hasColumn('digital_products', 'is_public')) {
                    $table->boolean('is_public')->default(true);
                }
            });
        }

        if (Schema::hasTable('gift_transactions')) {
            Schema::table('gift_transactions', function (Blueprint $table) {
                if (!Schema::hasColumn('gift_transactions', 'community_id')) {
                    $table->foreignId('community_id')->nullable()->constrained('communities')->nullOnDelete();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('courses')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->dropConstrainedForeignId('community_id');
                $table->dropColumn('is_public');
            });
        }
        if (Schema::hasTable('digital_products')) {
            Schema::table('digital_products', function (Blueprint $table) {
                $table->dropConstrainedForeignId('community_id');
                $table->dropColumn('is_public');
            });
        }
        if (Schema::hasTable('gift_transactions')) {
            Schema::table('gift_transactions', function (Blueprint $table) {
                $table->dropConstrainedForeignId('community_id');
            });
        }
    }
};
