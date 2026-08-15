<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_catalog_id')->constrained('product_catalogs')->onDelete('cascade');
            $table->string('retailer_product_id')->index(); // ID in advertiser's own system
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('image_url')->nullable();
            $table->string('product_url')->nullable();
            $table->integer('price')->default(0); // in cents
            $table->string('currency', 3)->default('USD');
            $table->boolean('in_stock')->default(true);
            $table->timestamps();

            $table->unique(['product_catalog_id', 'retailer_product_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
