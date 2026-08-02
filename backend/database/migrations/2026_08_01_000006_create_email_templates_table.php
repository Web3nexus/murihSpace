<?php

use App\Mail\EmailTemplateDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_templates', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->string('description')->nullable();
            $table->string('subject')->nullable();
            $table->text('body_html');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $now = now();

        foreach (EmailTemplateDefaults::all() as $key => $attributes) {
            DB::table('email_templates')->insert(
                ['key' => $key, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now] + $attributes
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('email_templates');
    }
};
