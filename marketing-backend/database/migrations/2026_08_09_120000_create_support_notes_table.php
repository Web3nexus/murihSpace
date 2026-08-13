<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_notes', function (Blueprint $table) {
            $table->id();
            $table->string('customer_email', 320);
            $table->foreignId('staff_user_id')->nullable()->constrained('staff_users')->nullOnDelete();
            $table->text('body');
            $table->timestamps();

            $table->index('customer_email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_notes');
    }
};
