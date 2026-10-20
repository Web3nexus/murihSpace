<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Ads staff sign-in from the marketing hub. The hub is the only issuer; there is
 * no password path. Covers the legacy email login removal and the staff token
 * contract (valid, expired, tampered, disabled, replayed, unconfigured).
 */
class StaffHubSignInTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'test-staff-hub-secret-with-enough-entropy';
    private const ENDPOINT = '/api/auth/staff/hub-session';

    protected function setUp(): void
    {
        parent::setUp();

        config(['ads.staff_hub_secret' => self::SECRET]);
        Cache::flush();
    }

    /** @param array<string, mixed> $overrides */
    private function staffToken(array $overrides = [], ?string $secret = null): string
    {
        $now = time();
        $claims = array_merge([
            'v' => 1,
            'typ' => 'ads-staff',
            'sid' => 'hub-staff-42',
            'role' => 'admin',
            'status' => 'active',
            'iat' => $now,
            'exp' => $now + 120,
            'jti' => bin2hex(random_bytes(12)),
        ], $overrides);

        $encoded = rtrim(strtr(base64_encode(json_encode($claims)), '+/', '-_'), '=');

        return $encoded.'.'.hash_hmac('sha256', $encoded, $secret ?? self::SECRET);
    }

    private function signIn(string $token)
    {
        return $this->postJson(self::ENDPOINT, ['token' => $token]);
    }

    public function test_legacy_email_login_is_gone(): void
    {
        $this->postJson('/api/auth/murihspace-sso', [
            'token' => 'anything.at-all',
        ])->assertNotFound();

        $this->postJson('/api/auth/login', [
            'email' => 'staff@example.com',
            'password' => 'password',
        ])->assertNotFound();
    }

    public function test_valid_staff_token_creates_an_admin_session_that_reaches_admin_routes(): void
    {
        $response = $this->signIn($this->staffToken())
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('staff.id', 'hub-staff-42')
            ->assertJsonPath('staff.role', 'admin');

        $this->assertNotEmpty($response->json('token'));
        $this->assertDatabaseHas('users', ['staff_hub_id' => 'hub-staff-42', 'murihspace_user_id' => null, 'email' => null]);

        $this->withToken($response->json('token'))
            ->getJson('/api/admin/advertisers/pending')
            ->assertOk();
    }

    public function test_staff_session_has_only_the_admin_ability_and_expires(): void
    {
        $response = $this->signIn($this->staffToken())->assertOk();

        $this->assertDatabaseHas('personal_access_tokens', [
            'name' => 'ads-staff-session',
            'abilities' => json_encode(['ads:admin']),
        ]);
        $this->assertNotNull(
            \Laravel\Sanctum\PersonalAccessToken::findToken($response->json('token'))->expires_at
        );
    }

    public function test_an_expired_staff_token_is_rejected(): void
    {
        $now = time();

        $this->signIn($this->staffToken(['iat' => $now - 200, 'exp' => $now - 100]))
            ->assertStatus(401)
            ->assertJsonPath('code', 'invalid_staff_token');

        $this->assertDatabaseMissing('users', ['staff_hub_id' => 'hub-staff-42']);
    }

    public function test_a_tampered_staff_token_is_rejected(): void
    {
        // Signed for a moderator, then the role claim is edited to admin while
        // the original signature is kept. The signature no longer matches.
        $token = $this->staffToken(['role' => 'moderator']);
        [$payload, $signature] = explode('.', $token);

        $claims = json_decode((string) base64_decode(strtr($payload, '-_', '+/')), true);
        $claims['role'] = 'admin';
        $forgedPayload = rtrim(strtr(base64_encode(json_encode($claims)), '+/', '-_'), '=');

        $this->signIn($forgedPayload.'.'.$signature)
            ->assertStatus(401)
            ->assertJsonPath('code', 'invalid_staff_token');

        $this->assertDatabaseMissing('users', ['staff_hub_id' => 'hub-staff-42']);
    }

    public function test_a_token_signed_with_another_secret_is_rejected(): void
    {
        $this->signIn($this->staffToken([], 'some-other-secret'))->assertStatus(401);
    }

    public function test_a_disabled_staff_member_is_refused_even_with_a_validly_signed_token(): void
    {
        $this->signIn($this->staffToken(['status' => 'disabled']))
            ->assertStatus(403)
            ->assertJsonPath('code', 'staff_not_active');

        $this->assertDatabaseMissing('users', ['staff_hub_id' => 'hub-staff-42']);
    }

    public function test_a_role_without_ads_access_is_refused(): void
    {
        $this->signIn($this->staffToken(['role' => 'support']))
            ->assertStatus(403)
            ->assertJsonPath('code', 'staff_not_active');
    }

    public function test_a_staff_token_can_be_used_only_once(): void
    {
        $token = $this->staffToken();

        $this->signIn($token)->assertOk();

        $this->signIn($token)
            ->assertStatus(401)
            ->assertJsonPath('code', 'invalid_staff_token');
    }

    public function test_staff_sign_in_is_refused_when_the_hub_secret_is_not_configured(): void
    {
        config(['ads.staff_hub_secret' => '']);

        $this->signIn($this->staffToken([], ''))
            ->assertStatus(503)
            ->assertJsonPath('code', 'staff_sign_in_unavailable');
    }

    public function test_a_missing_or_malformed_token_is_rejected(): void
    {
        $this->postJson(self::ENDPOINT, [])->assertStatus(422);
        $this->signIn('no-dot-here')->assertStatus(401);
        $this->signIn('.')->assertStatus(401);
    }

    public function test_an_advertiser_session_cannot_reach_admin_routes(): void
    {
        $advertiser = User::factory()->create(['murihspace_user_id' => 77]);
        $token = $advertiser->createToken('murihspace-ads-session', ['*'])->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/admin/advertisers/pending')
            ->assertForbidden();
    }
}
