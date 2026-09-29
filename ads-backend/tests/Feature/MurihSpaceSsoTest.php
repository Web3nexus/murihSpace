<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * The ads SSO endpoint used to verify against a hardcoded base64 key shipped
 * in the controller, so anyone who could read the repository could forge a
 * valid token. It must now verify ONLY against MURIHSPACE_APP_KEY from env and
 * reject outright when that key is unset or wrong.
 */
class MurihSpaceSsoTest extends TestCase
{
    use RefreshDatabase;

    private function tokenSignedWith(string $key, array $payload = []): string
    {
        $body = base64_encode(json_encode(array_merge([
            'user_id' => 1,
            'email' => 'advertiser@example.com',
            'name' => 'Advertiser',
            'role' => 'creator',
            'exp' => time() + 3600,
        ], $payload)));

        return $body.'.'.hash_hmac('sha256', $body, $key);
    }

    public function test_sso_is_rejected_and_logged_when_key_is_unset(): void
    {
        config(['services.murihspace.app_key' => '']);

        Log::shouldReceive('error')
            ->once()
            ->withArgs(fn ($msg) => str_contains((string) $msg, 'MURIHSPACE_APP_KEY is not configured'));

        $this->postJson('/api/auth/murihspace-sso', [
            'token' => $this->tokenSignedWith('anything'),
        ])->assertStatus(401);
    }

    public function test_sso_is_rejected_when_signed_with_a_different_key(): void
    {
        config(['services.murihspace.app_key' => 'base64:the-real-shared-key']);

        $this->postJson('/api/auth/murihspace-sso', [
            'token' => $this->tokenSignedWith('base64:some-other-key'),
        ])->assertStatus(401);
    }

    public function test_sso_rejects_a_token_signed_with_this_apps_own_key(): void
    {
        // The SSO trust is one-directional: only the core app's key may sign.
        // Previously this service ALSO accepted its own APP_KEY as a verifier,
        // which defeated the point of a dedicated shared secret.
        config(['services.murihspace.app_key' => 'base64:the-real-shared-key']);

        $this->postJson('/api/auth/murihspace-sso', [
            'token' => $this->tokenSignedWith((string) config('app.key')),
        ])->assertStatus(401);
    }

    public function test_valid_sso_token_creates_the_advertiser(): void
    {
        config(['services.murihspace.app_key' => 'base64:the-real-shared-key']);

        $res = $this->postJson('/api/auth/murihspace-sso', [
            'token' => $this->tokenSignedWith('base64:the-real-shared-key', [
                'user_id' => 77,
                'email' => 'advertiser@example.com',
                'name' => 'Advertiser',
            ]),
        ]);

        $res->assertOk();
        $this->assertDatabaseHas('users', ['email' => 'advertiser@example.com']);
        $this->assertDatabaseHas('advertisers', ['murihspace_user_id' => 77]);
    }

    public function test_expired_token_is_rejected(): void
    {
        config(['services.murihspace.app_key' => 'base64:the-real-shared-key']);

        $this->postJson('/api/auth/murihspace-sso', [
            'token' => $this->tokenSignedWith('base64:the-real-shared-key', ['exp' => time() - 60]),
        ])->assertStatus(401);
    }

    public function test_sso_rejects_normal_members_with_an_upgrade_message(): void
    {
        config(['services.murihspace.app_key' => 'base64:the-real-shared-key']);

        $res = $this->postJson('/api/auth/murihspace-sso', [
            'token' => $this->tokenSignedWith('base64:the-real-shared-key', [
                'user_id' => 88,
                'role' => 'member',
            ]),
        ]);

        $res->assertStatus(403)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('message', 'You must upgrade your MurihSpace account to Creator or Vendor before you can use Ads Studio.');

        // No advertiser or local user must be created for ineligible members.
        $this->assertDatabaseMissing('advertisers', ['murihspace_user_id' => 88]);
        $this->assertDatabaseMissing('users', ['email' => 'advertiser@example.com']);
    }

    public function test_sso_rejects_a_missing_role_as_ineligible(): void
    {
        config(['services.murihspace.app_key' => 'base64:the-real-shared-key']);

        $this->postJson('/api/auth/murihspace-sso', [
            'token' => $this->tokenSignedWith('base64:the-real-shared-key', [
                'user_id' => 89,
                'role' => '',
            ]),
        ])->assertStatus(403);
    }

    public function test_sso_allows_vendor_and_admin_roles(): void
    {
        config(['services.murihspace.app_key' => 'base64:the-real-shared-key']);

        foreach (['vendor', 'admin'] as $role) {
            $res = $this->postJson('/api/auth/murihspace-sso', [
                'token' => $this->tokenSignedWith('base64:the-real-shared-key', [
                    'user_id' => $role === 'vendor' ? 90 : 91,
                    'email' => $role.'@example.com',
                    'role' => $role,
                ]),
            ]);

            $res->assertOk();
        }

        $this->assertDatabaseHas('advertisers', ['murihspace_user_id' => 90]);
        $this->assertDatabaseHas('advertisers', ['murihspace_user_id' => 91]);
    }
}