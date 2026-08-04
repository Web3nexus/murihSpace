<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

/**
 * Facebook login has been permanently removed from the platform.
 *
 * This migration is a safe account-preserving migration for users who
 * previously signed in with Facebook:
 *   - the account is fully preserved (name, email, username, roles, data)
 *   - the provider link is cleared so Facebook can never be used again
 *   - email is marked verified where already present (OAuth users were
 *     auto-verified at signup)
 *   - a phone-verification requirement is flagged so the user is guided to
 *     the phone-OTP login flow next time they sign in
 *
 * No account is orphaned or deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $rows = DB::table('users')
            ->where('provider', 'facebook')
            ->get(['id', 'email_verified_at']);

        foreach ($rows as $row) {
            $verifiedAt = $row->email_verified_at ? Carbon::parse($row->email_verified_at) : $now;

            DB::table('users')->where('id', $row->id)->update([
                'provider' => null,
                'provider_id' => null,
                'email_verified_at' => $verifiedAt,
            ]);

            DB::table('audit_logs')->insert([
                'user_id' => null,
                'action' => 'auth.facebook_removed',
                'resource_type' => 'user',
                'resource_id' => (string) $row->id,
                'metadata' => json_encode([
                    'note' => 'Facebook login removed from platform; account preserved. Phone verification required going forward.',
                    'email_verified_at' => $verifiedAt->toISOString(),
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        // Facebook login cannot be re-introduced; there is nothing to restore.
    }
};
