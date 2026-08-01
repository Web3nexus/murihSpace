<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coin_packs', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedInteger('coins');
            $table->unsignedInteger('bonus_coins')->default(0);
            $table->unsignedInteger('price'); // minor units (kobo/cents)
            $table->string('currency', 3)->default('NGN');
            $table->string('badge')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('coin_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('coin_pack_id')->constrained()->onDelete('cascade');
            $table->unsignedInteger('coins');
            $table->unsignedInteger('bonus_coins')->default(0);
            $table->unsignedInteger('amount_paid'); // minor units
            $table->string('currency', 3)->default('NGN');
            $table->string('status')->default('completed');
            $table->string('provider', 20)->default('mock');
            $table->string('reference', 64)->nullable()->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coin_purchases');
        Schema::dropIfExists('coin_packs');
    }
};
