<?php

namespace Tests\Feature;

use App\Enums\AdminRole;
use App\Models\User;
use App\Services\TwoFactorAuthService;
use App\Support\AdminSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Guards the administration credential boundary recorded as SEC-003.
 *
 * The property under test throughout: the administration surface must be
 * unreachable by anything except a session that cleared a second factor. A role
 * check is not a session check, and a password is not a session.
 */
class AdminAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['sanctum.admin_require_mfa' => true]);
    }

    private function enrolledAdmin(?AdminRole $role = AdminRole::SupportAdmin): User
    {
        $service = app(TwoFactorAuthService::class);
        $secret = $service->generateSecret();

        return User::factory()->create([
            'role' => 'admin',
            'admin_role' => $role?->value,
            'two_factor_secret' => $service->encryptSecret($secret),
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => json_encode(['AAAAA-BBBBB-CCCCC']),
        ]);
    }

    private function totpFor(User $user): string
    {
        $service = app(TwoFactorAuthService::class);
        $secret = $service->decryptSecret($user->two_factor_secret);

        // Reuse the service's own maths via reflection so the test cannot drift
        // from the implementation's notion of "the current code".
        $method = new \ReflectionMethod($service, 'generateOTP');
        $method->setAccessible(true);

        return $method->invoke($service, $secret, time());
    }

    // ── Step 1: password alone must never yield a session ──────────────────

    public function test_a_correct_password_alone_yields_no_session(): void
    {
        $admin = $this->enrolledAdmin();

        $response = $this->postJson('/api/v1/securegate/auth/login', [
            'email' => $admin->email,
            'password' => 'password',
        ]);

        $response->assertStatus(202)
            ->assertJsonPath('data.status', 'two_factor_required')
            ->assertJsonStructure(['data' => ['challenge', 'expires_in_seconds']])
            ->assertJsonMissingPath('data.token');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_a_wrong_password_is_refused(): void
    {
        $admin = $this->enrolledAdmin();

        $this->postJson('/api/v1/securegate/auth/login', [
            'email' => $admin->email,
            'password' => 'not-the-password',
        ])->assertStatus(422);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    /**
     * A non-administrator must be indistinguishable from a wrong password,
     * otherwise this endpoint enumerates which addresses belong to
     * administrators.
     */
    public function test_a_non_admin_is_refused_identically_to_a_wrong_password(): void
    {
        $member = User::factory()->create(['role' => 'member']);

        $memberResponse = $this->postJson('/api/v1/securegate/auth/login', [
            'email' => $member->email,
            'password' => 'password',
        ]);

        $absentResponse = $this->postJson('/api/v1/securegate/auth/login', [
            'email' => 'nobody@murihspace.test',
            'password' => 'password',
        ]);

        $this->assertSame($absentResponse->status(), $memberResponse->status());
        $this->assertSame(
            $absentResponse->json('errors.email.0'),
            $memberResponse->json('errors.email.0'),
            'The non-admin refusal must not be distinguishable from an unknown account.',
        );
    }

    public function test_an_admin_without_enrolled_mfa_is_told_how_to_enrol_rather_than_admitted(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'admin_role' => 'support_admin']);

        $this->postJson('/api/v1/securegate/auth/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])
            ->assertStatus(403)
            ->assertJsonPath('errors.code.0', 'admin_mfa_enrollment_required');
    }

    // ── Step 2: the second factor mints the session ────────────────────────

    public function test_password_plus_second_factor_issues_an_administration_session(): void
    {
        $admin = $this->enrolledAdmin(AdminRole::KycAdmin);

        $challenge = $this->postJson('/api/v1/securegate/auth/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])->json('data.challenge');

        $response = $this->postJson('/api/v1/securegate/auth/2fa/verify', [
            'challenge' => $challenge,
            'code' => $this->totpFor($admin),
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.user.is_super_admin', false)
            ->assertJsonPath('data.user.admin_role', 'kyc_admin')
            ->assertJsonPath('data.user.mfa_enrolled', true)
            ->assertJsonStructure(['data' => ['token', 'expires_at']]);

        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $admin->id,
            'name' => AdminSession::TOKEN_NAME,
        ]);
    }

    /**
     * The session must carry the ability IsAdmin insists on. Without it the
     * administration surface stays shut even to a valid holder of the token.
     */
    public function test_the_issued_session_carries_the_mfa_ability_and_opens_the_surface(): void
    {
        $admin = $this->enrolledAdmin();

        $token = $this->completeLogin($admin);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/securegate/dashboard')
            ->assertStatus(200);
    }

    /**
     * The 30-day consumer fallback is not acceptable for a token that can move
     * money and edit settings, so the administration token carries its own,
     * shorter expiry.
     */
    public function test_the_administration_session_expires_far_sooner_than_a_consumer_session(): void
    {
        $admin = $this->enrolledAdmin();

        $this->completeLogin($admin);

        $record = $admin->tokens()->where('name', AdminSession::TOKEN_NAME)->firstOrFail();

        $minutes = now()->diffInMinutes($record->expires_at, false);

        $this->assertLessThanOrEqual(481, $minutes, 'Administration tokens must use sanctum.admin_expiration.');
        $this->assertGreaterThan(60, $minutes);
    }

    public function test_a_wrong_second_factor_issues_nothing(): void
    {
        $admin = $this->enrolledAdmin();

        $challenge = $this->postJson('/api/v1/securegate/auth/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])->json('data.challenge');

        $this->postJson('/api/v1/securegate/auth/2fa/verify', [
            'challenge' => $challenge,
            'code' => '000000',
        ])->assertStatus(422);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_a_challenge_is_single_use(): void
    {
        $admin = $this->enrolledAdmin();
        $code = $this->totpFor($admin);

        $challenge = $this->postJson('/api/v1/securegate/auth/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])->json('data.challenge');

        $this->postJson('/api/v1/securegate/auth/2fa/verify', [
            'challenge' => $challenge,
            'code' => $code,
        ])->assertStatus(200);

        // Replaying the captured challenge must not mint a second session.
        $this->postJson('/api/v1/securegate/auth/2fa/verify', [
            'challenge' => $challenge,
            'code' => $code,
        ])->assertStatus(422);
    }

    /**
     * A challenge is bound to the address that created it, so one harvested
     * from a log or a proxy cannot be completed from somewhere else.
     */
    public function test_a_challenge_cannot_be_completed_from_another_address(): void
    {
        $admin = $this->enrolledAdmin();

        $challenge = $this->postJson('/api/v1/securegate/auth/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])->json('data.challenge');

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])
            ->postJson('/api/v1/securegate/auth/2fa/verify', [
                'challenge' => $challenge,
                'code' => $this->totpFor($admin),
            ])
            ->assertStatus(422);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_recovery_codes_are_accepted_once_each(): void
    {
        $admin = $this->enrolledAdmin();

        $challenge = $this->postJson('/api/v1/securegate/auth/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])->json('data.challenge');

        $this->postJson('/api/v1/securegate/auth/2fa/verify', [
            'challenge' => $challenge,
            'code' => 'aaaaa-bbbbb-ccccc',
        ])->assertStatus(200);

        $this->assertSame(
            [],
            json_decode($admin->fresh()->two_factor_recovery_codes, true),
            'A spent recovery code must be removed from the account.',
        );
    }

    // ── The boundary IsAdmin actually enforces ─────────────────────────────

    /**
     * This is the bypass SEC-003 closed. An administrator can still sign in at
     * the shared consumer endpoint — they must, in order to enrol — and that
     * token must not open the administration surface.
     */
    public function test_a_consumer_login_session_cannot_open_the_administration_surface(): void
    {
        $admin = $this->enrolledAdmin();

        // Exactly what /auth/login issues: a wildcard consumer token.
        $this->bearer($admin->createToken('auth-token', ['*'])->plainTextToken);

        $this->getJson('/api/v1/securegate/dashboard')
            ->assertStatus(403)
            ->assertJsonPath('errors.code', 'admin_mfa_required');

        $this->getJson('/api/v1/securegate/me')
            ->assertStatus(403)
            ->assertJsonPath('errors.code', 'admin_mfa_required');
    }

    public function test_a_consumer_session_cannot_reach_a_permission_guarded_route_either(): void
    {
        $admin = $this->enrolledAdmin(AdminRole::SuperAdmin);

        $this->bearer($admin->createToken('auth-token', ['*'])->plainTextToken);

        $this->getJson('/api/v1/securegate/settings')->assertStatus(403);
    }

    public function test_a_member_is_still_refused_outright(): void
    {
        $member = User::factory()->create(['role' => 'member']);
        $this->bearer($member->createToken('admin-token', ['*', AdminSession::ABILITY_MFA])->plainTextToken);

        $this->getJson('/api/v1/securegate/dashboard')->assertStatus(403);
    }

    public function test_logout_revokes_only_the_current_administration_session(): void
    {
        $admin = $this->enrolledAdmin();

        $this->bearer($admin->createToken(AdminSession::TOKEN_NAME, ['*', AdminSession::ABILITY_MFA])->plainTextToken);
        // A second device the operator is working from.
        $admin->tokens()->create(['name' => AdminSession::TOKEN_NAME, 'token' => str_repeat('a', 64)]);

        $this->postJson('/api/v1/securegate/auth/logout')->assertStatus(200);

        $this->assertNotNull(
            $admin->tokens()->where('name', AdminSession::TOKEN_NAME)->first(),
            'Logging out must not revoke the operator’s other devices.',
        );
    }

    /** Sanity: the challenge cache must not leak between tests. */
    public function test_challenges_do_not_survive_the_request(): void
    {
        Cache::flush();

        $this->assertNull(AdminSession::resolveChallenge('anything', request()));
    }

    /**
     * Present a bearer token for the rest of the test.
     *
     * Deliberately not Sanctum::actingAs(): that installs a TransientToken,
     * which reports can() === true for everything and carries no name, so it
     * would sail through a provenance check it should fail.
     */
    private function bearer(string $plainTextToken): void
    {
        $this->withHeader('Authorization', 'Bearer '.$plainTextToken);
    }

    private function completeLogin(User $admin): string
    {
        $challenge = $this->postJson('/api/v1/securegate/auth/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])->json('data.challenge');

        return $this->postJson('/api/v1/securegate/auth/2fa/verify', [
            'challenge' => $challenge,
            'code' => $this->totpFor($admin),
        ])->json('data.token');
    }
}
