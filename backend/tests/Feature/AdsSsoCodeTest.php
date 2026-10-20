<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Ads\AdsSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Ads Manager sign-in: a MurihSpace user asks for a code bound to the configured
 * ads redirect, and Ads Manager exchanges it server-to-server for identity.
 */
class AdsSsoCodeTest extends TestCase
{
    use RefreshDatabase;

    private const REDIRECT = 'https://ads.murihspace.test/auth/sso/callback';

    private const INTERNAL_TOKEN = 'test-internal-token';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.ads_sso.redirect_uri' => self::REDIRECT,
            'internal.token' => self::INTERNAL_TOKEN,
        ]);
    }

    public function test_eligible_user_gets_a_code_bound_to_the_configured_redirect(): void
    {
        $creator = User::factory()->create(['role' => 'creator']);
        Sanctum::actingAs($creator);

        $response = $this->postJson('/api/v1/ads/sso/code')
            ->assertOk()
            ->assertJsonPath('data.redirect_uri', self::REDIRECT)
            ->assertJsonPath('data.expires_in', 120)
            ->assertJsonMissingPath('data.email');

        $this->assertGreaterThanOrEqual(32, strlen((string) $response->json('data.code')));
    }

    public function test_redirect_supplied_by_the_request_is_ignored(): void
    {
        $creator = User::factory()->create(['role' => 'vendor']);
        Sanctum::actingAs($creator);

        $this->postJson('/api/v1/ads/sso/code', ['redirect_uri' => 'https://attacker.example/steal'])
            ->assertOk()
            ->assertJsonPath('data.redirect_uri', self::REDIRECT);
    }

    public function test_member_cannot_get_a_code_and_is_told_to_upgrade(): void
    {
        $member = User::factory()->create(['role' => 'member']);
        Sanctum::actingAs($member);

        $this->postJson('/api/v1/ads/sso/code')
            ->assertForbidden()
            ->assertJsonPath('errors.code', 'ads_upgrade_required');
    }

    public function test_unauthenticated_request_gets_no_code(): void
    {
        $this->postJson('/api/v1/ads/sso/code')->assertUnauthorized();
    }

    public function test_code_endpoint_refuses_when_no_redirect_is_configured(): void
    {
        config(['services.ads_sso.redirect_uri' => null]);
        Sanctum::actingAs(User::factory()->create(['role' => 'creator']));

        $this->postJson('/api/v1/ads/sso/code')->assertStatus(503);
    }

    public function test_blank_redirect_env_falls_back_to_the_frontend_url(): void
    {
        // .env.example ships ADS_SSO_REDIRECT_URI empty, which env() returns as '' rather than the default.
        $env = ['ADS_SSO_REDIRECT_URI' => '', 'ADS_FRONTEND_URL' => 'https://ads.example.test/'];
        foreach ($env as $key => $value) {
            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }

        try {
            $config = require base_path('config/services.php');
        } finally {
            foreach (array_keys($env) as $key) {
                putenv($key);
                unset($_ENV[$key], $_SERVER[$key]);
            }
        }

        $this->assertSame('https://ads.example.test/auth/sso/callback', $config['ads_sso']['redirect_uri']);
    }

    public function test_exchange_returns_identity_only_and_no_contact_details(): void
    {
        $creator = User::factory()->create([
            'role' => 'creator',
            'username' => 'creator_one',
            'mobile_number' => '+2348099887766',
        ]);
        Sanctum::actingAs($creator);
        $code = $this->issueCode();

        $response = $this->exchange($code)
            ->assertOk()
            ->assertJsonPath('data.user.id', $creator->id)
            ->assertJsonPath('data.user.name', $creator->name)
            ->assertJsonPath('data.user.username', 'creator_one')
            ->assertJsonPath('data.sync.status', 'unavailable')
            ->assertJsonPath('data.sync.key', 'murihspace_user_id');

        $this->assertSame(['id', 'name', 'username', 'avatar_url'], array_keys($response->json('data.user')));
        $this->assertStringNotContainsString($creator->email, $response->getContent());
        $this->assertStringNotContainsString('+2348099887766', $response->getContent());
    }

    public function test_sync_is_run_for_the_exchanged_user_and_reports_synced(): void
    {
        $creator = User::factory()->create(['role' => 'creator']);
        Sanctum::actingAs($creator);
        $code = $this->issueCode();

        $this->mock(AdsSyncService::class, function ($mock) use ($creator) {
            $mock->shouldReceive('syncUserToAdsDb')
                ->once()
                ->withArgs(fn (User $user) => $user->id === $creator->id)
                ->andReturn(true);
        });

        $this->exchange($code)
            ->assertOk()
            ->assertJsonPath('data.sync.status', 'synced');
    }

    public function test_code_works_exactly_once(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'creator']));
        $code = $this->issueCode();

        $this->exchange($code)->assertOk();

        $this->exchange($code)
            ->assertUnauthorized()
            ->assertJsonPath('code', 'invalid_code');
    }

    public function test_code_expires_after_two_minutes(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'creator']));
        $code = $this->issueCode();

        $this->travel(121)->seconds();

        $this->exchange($code)->assertUnauthorized()->assertJsonPath('code', 'invalid_code');
    }

    public function test_mismatched_redirect_is_refused_and_burns_the_code(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'creator']));
        $code = $this->issueCode();

        $this->exchange($code, 'https://elsewhere.example/callback')
            ->assertStatus(422)
            ->assertJsonPath('code', 'redirect_mismatch');

        $this->exchange($code)->assertUnauthorized();
    }

    public function test_exchange_refuses_a_request_without_the_internal_token(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'creator']));
        $code = $this->issueCode();

        $this->postJson('/internal/ads/sso/exchange', ['code' => $code, 'redirect_uri' => self::REDIRECT], $this->headers(token: 'wrong'))
            ->assertForbidden();

        // The refused request must not have spent the code.
        $this->exchange($code)->assertOk();
    }

    public function test_exchange_refuses_a_user_who_is_no_longer_eligible(): void
    {
        $creator = User::factory()->create(['role' => 'creator']);
        Sanctum::actingAs($creator);
        $code = $this->issueCode();

        $creator->forceFill(['role' => 'member'])->save();

        $this->exchange($code)->assertForbidden()->assertJsonPath('code', 'ads_upgrade_required');
    }

    private function issueCode(): string
    {
        return (string) $this->postJson('/api/v1/ads/sso/code')->assertOk()->json('data.code');
    }

    private function exchange(string $code, ?string $redirectUri = null)
    {
        return $this->postJson('/internal/ads/sso/exchange', [
            'code' => $code,
            'redirect_uri' => $redirectUri ?? self::REDIRECT,
        ], $this->headers());
    }

    /** @return array<string, string> */
    private function headers(?string $token = null): array
    {
        return [
            'X-Internal-Token' => $token ?? self::INTERNAL_TOKEN,
            'X-Timestamp' => (string) now()->timestamp,
            'X-Nonce' => Str::random(32),
        ];
    }
}
