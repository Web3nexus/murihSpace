<?php

use App\Mail\EmailTemplateDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Seed the user/community/request email templates. Idempotent: existing
     * rows are left untouched, missing keys are inserted from the defaults.
     */
    public function up(): void
    {
        foreach (EmailTemplateDefaults::all() as $key => $defaults) {
            DB::table('email_templates')->updateOrInsert(
                ['key' => $key],
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
    }

    public function down(): void
    {
        DB::table('email_templates')->whereIn('key', array_keys(EmailTemplateDefaults::all()))->whereIn('key', [
            'welcome',
            'password_reset',
            'friend_request_received',
            'friend_request_accepted',
            'community_join_request',
            'community_join_approved',
            'community_join_rejected',
            'community_role_updated',
            'donation_received',
            'content_removed',
        ])->delete();
    }
};
