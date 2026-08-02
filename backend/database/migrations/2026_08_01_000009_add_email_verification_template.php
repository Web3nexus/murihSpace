<?php

use App\Mail\EmailTemplateDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $defaults = EmailTemplateDefaults::get('email_verification');

        if ($defaults === null) {
            return;
        }

        DB::table('email_templates')->updateOrInsert(
            ['key' => 'email_verification'],
            [
                'name' => $defaults['name'],
                'description' => $defaults['description'],
                'subject' => $defaults['subject'],
                'body_html' => $defaults['body_html'],
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        DB::table('email_templates')->where('key', 'email_verification')->delete();
    }
};
