<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_reviews', function (Blueprint $table) {
            $table->text('vendor_reply')->nullable()->after('body');
            $table->timestamp('vendor_replied_at')->nullable()->after('vendor_reply');
        });
    }

    public function down(): void
    {
        Schema::table('product_reviews', function (Blueprint $table) {
            $table->dropColumn(['vendor_reply', 'vendor_replied_at']);
        });
    }
};
