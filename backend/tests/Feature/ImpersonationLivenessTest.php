<?php

namespace Tests\Feature;

use App\Http\Middleware\EnsureImpersonationLiveness;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class ImpersonationLivenessTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A regular login token is issued with the wildcard '*' ability, which makes
     * Sanctum's can('impersonate') return true. The middleware must still treat
     * it as a normal session: it must not delete the token and must not 401.
     */
    public function test_regular_auth_token_is_not_treated_as_impersonation(): void
    {
        $user = User::factory()->create();
        $result = $user->createToken('auth-token', ['*']);
        $token = $result->accessToken;

        $this->assertTrue($token->can('impersonate'));
        $this->assertFalse(EnsureImpersonationLiveness::isImpersonationToken($token));

        $this->withToken($result->plainTextToken)
            ->getJson('/api/v1/feature-flags')
            ->assertOk();

        $this->assertNotNull(PersonalAccessToken::find($token->id), 'Regular token must not be deleted.');
    }

    /**
     * An admin session token must survive too, even though admins are the ones
     * who trigger impersonation.
     */
    public function test_admin_auth_token_is_not_treated_as_impersonation(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'admin_role' => 'super_admin']);
        $result = $admin->createToken('auth-token', ['*']);
        $token = $result->accessToken;

        $this->assertFalse(EnsureImpersonationLiveness::isImpersonationToken($token));

        $this->withToken($result->plainTextToken)
            ->getJson('/api/v1/feature-flags')
            ->assertOk();

        $this->assertNotNull(PersonalAccessToken::find($token->id), 'Admin token must not be deleted.');
    }

    /**
     * Repeated requests must keep working — the original bug deleted the token on
     * the very first request, locking the user out permanently.
     */
    public function test_regular_token_survives_repeated_requests(): void
    {
        $user = User::factory()->create();
        $result = $user->createToken('auth-token', ['*']);

        for ($i = 0; $i < 3; $i++) {
            $this->withToken($result->plainTextToken)
                ->getJson('/api/v1/feature-flags')
                ->assertOk();
        }

        $this->assertNotNull(PersonalAccessToken::find($result->accessToken->id));
    }

    public function test_impersonation_token_is_detected(): void
    {
        $target = User::factory()->create();
        $token = $target->createToken('impersonation-token', ['*', 'impersonate'])->accessToken;

        $this->assertTrue(EnsureImpersonationLiveness::isImpersonationToken($token));
        $this->assertFalse(EnsureImpersonationLiveness::isImpersonationToken(null));
    }

    /**
     * An impersonation token with no live session is revoked with 401.
     */
    public function test_impersonation_token_without_session_is_rejected(): void
    {
        $target = User::factory()->create();
        $result = $target->createToken('impersonation-token', ['*', 'impersonate']);
        $tokenId = $result->accessToken->id;

        Cache::forget("impersonation_session_{$tokenId}");

        $this->withToken($result->plainTextToken)
            ->getJson('/api/v1/feature-flags')
            ->assertStatus(401);

        $this->assertNull(PersonalAccessToken::find($tokenId));
    }

    /**
     * A live impersonation session within the idle window is allowed through and
     * has its activity timestamp refreshed.
     */
    public function test_active_impersonation_session_is_allowed_and_refreshed(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'admin_role' => 'super_admin']);
        $target = User::factory()->create();

        $result = $target->createToken('impersonation-token', ['*', 'impersonate']);
        $tokenId = $result->accessToken->id;
        $key = "impersonation_session_{$tokenId}";

        Cache::put($key, [
            'admin_id'             => $admin->id,
            'admin_email'          => $admin->email,
            'admin_token_id'       => null,
            'target_id'            => $target->id,
            'target_email'         => $target->email,
            'started_at'           => now()->timestamp,
            'last_activity_at'     => now()->timestamp,
            'idle_timeout_seconds' => 900,
        ], now()->addHours(2));

        $this->withToken($result->plainTextToken)
            ->getJson('/api/v1/feature-flags')
            ->assertOk();

        $this->assertNotNull(PersonalAccessToken::find($tokenId));
        $this->assertIsArray(Cache::get($key));
    }

    /**
     * An idle impersonation session past the 15-minute window is revoked.
     */
    public function test_idle_impersonation_session_is_rejected(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'admin_role' => 'super_admin']);
        $target = User::factory()->create();

        $result = $target->createToken('impersonation-token', ['*', 'impersonate']);
        $tokenId = $result->accessToken->id;
        $key = "impersonation_session_{$tokenId}";

        Cache::put($key, [
            'admin_id'             => $admin->id,
            'admin_email'          => $admin->email,
            'admin_token_id'       => null,
            'target_id'            => $target->id,
            'target_email'         => $target->email,
            'started_at'           => now()->subHour()->timestamp,
            'last_activity_at'     => now()->subHour()->timestamp,
            'idle_timeout_seconds' => 900,
        ], now()->addHours(2));

        $this->withToken($result->plainTextToken)
            ->getJson('/api/v1/feature-flags')
            ->assertStatus(401);

        $this->assertNull(PersonalAccessToken::find($tokenId));
    }

    /**
     * Stopping impersonation with a normal token must not delete that token.
     */
    public function test_stop_impersonate_does_not_delete_a_regular_token(): void
    {
        $user = User::factory()->create();
        $result = $user->createToken('auth-token', ['*']);
        $tokenId = $result->accessToken->id;

        $this->withToken($result->plainTextToken)
            ->postJson('/api/v1/auth/stop-impersonate')
            ->assertStatus(200);

        $this->assertNotNull(
            PersonalAccessToken::find($tokenId),
            'stop-impersonate must not revoke a regular session token.'
        );
    }
}
