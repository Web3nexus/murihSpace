<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fulfilment_disputes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fulfilment_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('raised_by')->constrained('users')->cascadeOnDelete();
            $table->string('subject');
            $table->text('description');
            $table->string('status')->default('open');
            $table->text('resolution')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['fulfilment_order_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fulfilment_disputes');
    }
};
