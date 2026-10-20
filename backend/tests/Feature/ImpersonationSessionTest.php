<?php

namespace Tests\Feature;

use App\Enums\AdminRole;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\AdminSession;
use App\Support\ImpersonationSession;
use App\Support\WebSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/**
 * Web impersonation lives in the administrator's session, not in a bearer token.
 *
 * A web session is simulated the way the cookie guard would see it: the session
 * holds the guard's user key and the admin-token binding. That is what
 * AdminAuthController leaves behind after a second factor, so IsAdmin sees the
 * same thing it sees in production.
 */
class ImpersonationSessionTest extends TestCase
{
    use RefreshDatabase;

    private const WEB_ORIGIN = 'https://web.test';

    protected function setUp(): void
    {
        parent::setUp();

        config(['sanctum.stateful' => ['web.test']]);
    }

    public function test_start_switches_the_session_to_the_target_without_issuing_a_token(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();
        $this->signInAs($admin, $this->adminToken($admin));

        $response = $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate");

        $response->assertOk()
            ->assertJsonPath('data.impersonating', true)
            ->assertJsonPath('data.user.id', $target->id)
            ->assertJsonMissingPath('data.token');

        $this->assertSame(0, PersonalAccessToken::query()
            ->where('tokenable_id', $target->id)->count(), 'No bearer token may be issued for impersonation.');

        $this->getJson('/api/v1/user')
            ->assertOk()
            ->assertJsonPath('data.id', $target->id)
            ->assertJsonPath('data.impersonating', true);
    }

    public function test_admin_without_user_permission_cannot_impersonate(): void
    {
        $support = User::factory()->create([
            'role' => 'admin',
            'admin_role' => AdminRole::SupportStaff->value,
            'admin_permissions' => [],
        ]);
        $target = User::factory()->create();
        $this->signInAs($support, $this->adminToken($support));

        $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate")->assertForbidden();
    }

    public function test_admin_without_mfa_cannot_impersonate(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();

        // A consumer session, bound to an auth-token row: the password-only login.
        $this->signInAs($admin, $admin->createToken('auth-token', ['*'])->accessToken);

        $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate")
            ->assertForbidden()
            ->assertJsonPath('errors.code', 'admin_mfa_required');

        $this->assertSame(0, AuditLog::where('action', 'user.impersonated')->count());
    }

    public function test_bearer_admin_cannot_impersonate_because_there_is_no_session_to_switch(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$admin->createToken(AdminSession::TOKEN_NAME, ['*', AdminSession::ABILITY_MFA])->plainTextToken)
            ->postJson("/api/v1/securegate/users/{$target->id}/impersonate")
            ->assertForbidden();
    }

    public function test_stop_restores_the_administrator_and_clears_the_marker(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();
        $this->signInAs($admin, $this->adminToken($admin));
        $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate")->assertOk();

        $this->postJson('/api/v1/auth/stop-impersonate')
            ->assertOk()
            ->assertJsonPath('data.impersonating', false);

        $this->getJson('/api/v1/user')
            ->assertOk()
            ->assertJsonPath('data.id', $admin->id)
            ->assertJsonPath('data.impersonating', false);

        $this->assertFalse(session()->has(ImpersonationSession::IMPERSONATOR_KEY));
    }

    public function test_revoked_admin_session_ends_impersonation(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();
        $token = $this->adminToken($admin);
        $this->signInAs($admin, $token);
        $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate")->assertOk();

        $token->delete();

        $this->getJson('/api/v1/user')
            ->assertUnauthorized()
            ->assertJsonPath('errors.code', 'ADMIN_SESSION_EXPIRED');

        $this->assertSame(1, AuditLog::where('action', 'user.impersonation_revoked')
            ->where('user_id', $admin->id)->count());
        $this->assertFalse(session()->has(ImpersonationSession::IMPERSONATOR_KEY));
    }

    public function test_expired_admin_session_ends_impersonation(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();
        $token = $this->adminToken($admin);
        $this->signInAs($admin, $token);
        $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate")->assertOk();

        $token->forceFill(['expires_at' => now()->subMinute()])->save();

        $this->getJson('/api/v1/user')
            ->assertUnauthorized()
            ->assertJsonPath('errors.code', 'ADMIN_SESSION_EXPIRED');
    }

    public function test_demoted_admin_ends_impersonation(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();
        $this->signInAs($admin, $this->adminToken($admin));
        $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate")->assertOk();

        $admin->forceFill(['role' => 'member', 'admin_role' => null])->save();

        $this->getJson('/api/v1/user')
            ->assertUnauthorized()
            ->assertJsonPath('errors.code', 'ADMIN_SESSION_EXPIRED');
    }

    public function test_idle_impersonation_ends_and_returns_the_administrator(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();
        $this->signInAs($admin, $this->adminToken($admin));
        $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate")->assertOk();

        $this->travel(ImpersonationSession::IDLE_SECONDS + 60)->seconds();

        $this->getJson('/api/v1/user')
            ->assertUnauthorized()
            ->assertJsonPath('errors.code', 'IMPERSONATION_TIMEOUT');

        $this->getJson('/api/v1/user')
            ->assertOk()
            ->assertJsonPath('data.id', $admin->id);

        $this->assertSame(1, AuditLog::where('action', 'user.impersonation_timed_out')->count());
    }

    public function test_activity_keeps_impersonation_alive_until_the_absolute_limit(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();
        $this->signInAs($admin, $this->adminToken($admin));
        $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate")->assertOk();

        // Activity inside the idle window keeps it alive, but the absolute cap still applies.
        for ($elapsed = 0; $elapsed < ImpersonationSession::MAX_SECONDS; $elapsed += 600) {
            $this->travel(600)->seconds();
            $this->getJson('/api/v1/user')->assertOk()->assertJsonPath('data.id', $target->id);
        }

        $this->travel(ImpersonationSession::MAX_SECONDS - $elapsed + 60)->seconds();

        $this->getJson('/api/v1/user')
            ->assertUnauthorized()
            ->assertJsonPath('errors.code', 'IMPERSONATION_TIMEOUT');

        $audit = AuditLog::where('action', 'user.impersonation_timed_out')->first();
        $this->assertNotNull($audit);
        $this->assertSame('time_limit', $audit->metadata['reason']);
    }

    public function test_start_and_stop_each_write_an_audit_row(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();
        $this->signInAs($admin, $this->adminToken($admin));

        $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate")->assertOk();
        $this->postJson('/api/v1/auth/stop-impersonate')->assertOk();

        $started = AuditLog::where('action', 'user.impersonated')->first();
        $this->assertNotNull($started);
        $this->assertSame($admin->id, $started->user_id);
        $this->assertSame((string) $target->id, (string) $started->resource_id);

        $stopped = AuditLog::where('action', 'user.impersonation_stopped')->first();
        $this->assertNotNull($stopped);
        $this->assertSame($admin->id, $stopped->user_id);
        $this->assertSame((string) $target->id, (string) $stopped->resource_id);
    }

    public function test_impersonated_logout_ends_the_session_and_leaves_the_targets_devices_alone(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();
        $targetDevice = $target->createToken('phone', ['*'])->accessToken;
        $this->signInAs($admin, $this->adminToken($admin));
        $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate")->assertOk();

        $this->postJson('/api/v1/auth/logout')->assertOk();

        $this->assertFalse(session()->has(ImpersonationSession::IMPERSONATOR_KEY));
        $this->assertNotNull(PersonalAccessToken::find($targetDevice->id));
    }

    public function test_impersonation_cannot_revoke_the_targets_other_devices(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();
        $targetDevice = $target->createToken('phone', ['*'])->accessToken;
        $this->signInAs($admin, $this->adminToken($admin));
        $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate")->assertOk();

        $this->postJson('/api/v1/auth/sessions/revoke-all-others')
            ->assertForbidden()
            ->assertJsonPath('errors.code', 'IMPERSONATION_ACTIVE');

        $this->assertNotNull(PersonalAccessToken::find($targetDevice->id));
    }

    public function test_impersonated_session_listing_and_password_change_do_not_fail_or_revoke_the_targets_devices(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create();
        $targetDevice = $target->createToken('phone', ['*'])->accessToken;
        $this->signInAs($admin, $this->adminToken($admin));
        $this->postJson("/api/v1/securegate/users/{$target->id}/impersonate")->assertOk();

        $this->getJson('/api/v1/auth/sessions')->assertOk();

        $this->putJson('/api/v1/auth/password', [
            'current_password' => 'password',
            'password' => 'Changed-Pass-1',
            'password_confirmation' => 'Changed-Pass-1',
        ])->assertOk();

        $this->assertNotNull(PersonalAccessToken::find($targetDevice->id));
    }

    /**
     * Each HTTP request in production builds its own guards, so the user comes
     * from the session every time. The test application is shared across
     * requests, so forget the cached guard user before each one.
     */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        $this->app['auth']->forgetGuards();

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }

    private function superAdmin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'admin_role' => AdminRole::SuperAdmin->value,
            'admin_permissions' => [],
        ]);
    }

    private function adminToken(User $admin): PersonalAccessToken
    {
        return $admin->createToken(AdminSession::TOKEN_NAME, ['*', AdminSession::ABILITY_MFA])->accessToken;
    }

    /**
     * Put the cookie-session guard into the state a completed login leaves it in.
     */
    private function signInAs(User $user, PersonalAccessToken $token): void
    {
        $this->withHeader('Origin', self::WEB_ORIGIN)->withSession([
            auth('web')->getName() => $user->getKey(),
            WebSession::TOKEN_KEY => $token->getKey(),
        ]);
    }
}
