<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('customer_email', 255)->nullable()->after('user_id');
            $table->string('customer_name', 255)->nullable()->after('customer_email');
            $table->unsignedTinyInteger('rating')->nullable()->after('closed_at');
            $table->string('rating_comment', 1000)->nullable()->after('rating');
            $table->timestamp('rated_at')->nullable()->after('rating_comment');

            $table->index('customer_email');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex(['customer_email']);
            $table->dropColumn([
                'customer_email', 'customer_name', 'rating',
                'rating_comment', 'rated_at',
            ]);
        });
    }
};
