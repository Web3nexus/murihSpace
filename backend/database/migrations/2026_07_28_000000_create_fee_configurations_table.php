<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fee_configurations', function (Blueprint $table) {
            $table->id();
            $table->string('fee_type')->unique();
            $table->string('name');
            $table->decimal('percentage', 5, 2)->default(0);
            $table->bigInteger('flat_fee')->default(0);
            $table->string('currency', 3)->default('NGN');
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();
        });

        DB::table('fee_configurations')->insert([
            [
                'fee_type' => 'digital_product',
                'name' => 'Digital Product Fee',
                'percentage' => 10.00,
                'flat_fee' => 0,
                'currency' => 'NGN',
                'is_active' => true,
                'description' => 'Platform fee charged on digital product sales',
            ],
            [
                'fee_type' => 'physical_product',
                'name' => 'Physical Product Fee',
                'percentage' => 5.00,
                'flat_fee' => 0,
                'currency' => 'NGN',
                'is_active' => true,
                'description' => 'Platform fee charged on physical product sales',
            ],
            [
                'fee_type' => 'subscription',
                'name' => 'Subscription Fee',
                'percentage' => 0,
                'flat_fee' => 0,
                'currency' => 'NGN',
                'is_active' => true,
                'description' => 'Platform fee charged on subscription payments',
            ],
            [
                'fee_type' => 'withdrawal',
                'name' => 'Withdrawal Fee',
                'percentage' => 0,
                'flat_fee' => 0,
                'currency' => 'NGN',
                'is_active' => true,
                'description' => 'Fee charged on withdrawal requests',
            ],
            [
                'fee_type' => 'transfer',
                'name' => 'P2P Transfer Fee',
                'percentage' => 0,
                'flat_fee' => 0,
                'currency' => 'NGN',
                'is_active' => true,
                'description' => 'Fee charged on peer-to-peer wallet transfers',
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('fee_configurations');
    }
};
