<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\StaffUser;
use App\Providers\AppServiceProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class AdsStaffTokenTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'test-hub-secret-value-000000000000';

    protected function setUp(): void
    {
        parent::setUp();

        config(['staff_ads.hub_secret' => self::SECRET]);
    }

    private function superAdmin(): StaffUser
    {
        return StaffUser::factory()->superAdmin()->create();
    }

    private function tokenFor(StaffUser $staff): string
    {
        return $staff->createToken('test', ['staff'], now()->addHour())->plainTextToken;
    }

    private function issueFor(StaffUser $target)
    {
        return $this->withToken($this->tokenFor($this->superAdmin()))
            ->postJson("/api/admin/staff/{$target->id}/ads-token");
    }

    public function test_super_admin_gets_an_admin_token_for_a_super_admin_and_it_is_audited(): void
    {
        $target = StaffUser::factory()->superAdmin()->create();

        $response = $this->issueFor($target)->assertCreated();

        $response->assertJsonPath('success', true)
            ->assertJsonPath('data.token_type', 'ads-staff')
            ->assertJsonPath('data.role', 'admin')
            ->assertJsonPath('data.staff_id', (string) $target->id)
            ->assertJsonStructure(['data' => ['token', 'expires_at']]);

        $claims = $this->verifyLikeAdsBackend($response->json('data.token'), time());
        $this->assertSame((string) $target->id, $claims['sid']);
        $this->assertSame('admin', $claims['role']);

        $this->assertDatabaseHas('audit_logs', [
            'action' => AuditLog::STAFF_ADS_TOKEN_ISSUE,
            'subject_id' => $target->id,
        ]);
    }

    public function test_a_content_manager_gets_a_moderator_token(): void
    {
        $target = StaffUser::factory()->role('content_manager')->create();

        $response = $this->issueFor($target)->assertCreated()->assertJsonPath('data.role', 'moderator');

        $claims = $this->verifyLikeAdsBackend($response->json('data.token'), time());
        $this->assertSame('moderator', $claims['role']);
    }

    public function test_issued_token_is_accepted_by_the_ads_verifier_rules(): void
    {
        $target = StaffUser::factory()->superAdmin()->create();

        $token = $this->issueFor($target)->json('data.token');

        $claims = $this->verifyLikeAdsBackend($token, time());
        $this->assertSame(1, $claims['v']);
        $this->assertSame('ads-staff', $claims['typ']);
        $this->assertSame('active', $claims['status']);
        $this->assertLessThanOrEqual(300, $claims['exp'] - $claims['iat']);
        $this->assertGreaterThan(time(), $claims['exp']);
    }

    public function test_a_token_signed_with_another_secret_is_rejected_by_the_ads_rules(): void
    {
        $target = StaffUser::factory()->superAdmin()->create();
        $token = $this->issueFor($target)->json('data.token');

        $this->expectExceptionMessage('invalid_staff_token');
        $this->verifyLikeAdsBackend($token, time(), 'some-other-secret-value-000000000');
    }

    public function test_token_lifetime_is_clamped_to_five_minutes(): void
    {
        config(['staff_ads.token_ttl_seconds' => 9999]);
        $target = StaffUser::factory()->superAdmin()->create();

        $token = $this->issueFor($target)->json('data.token');

        $claims = $this->verifyLikeAdsBackend($token, time());
        $this->assertSame(300, $claims['exp'] - $claims['iat']);
    }

    public function test_each_token_has_a_fresh_jti(): void
    {
        $target = StaffUser::factory()->superAdmin()->create();

        $first = $this->verifyLikeAdsBackend($this->issueFor($target)->json('data.token'), time());
        $second = $this->verifyLikeAdsBackend($this->issueFor($target)->json('data.token'), time());

        $this->assertNotSame($first['jti'], $second['jti']);
    }

    public function test_a_staff_member_without_a_matching_ads_role_gets_no_token(): void
    {
        $target = StaffUser::factory()->role('support_agent')->create();

        $this->issueFor($target)
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('errors.code.0', 'no_matching_role');

        $this->assertDatabaseMissing('audit_logs', ['action' => AuditLog::STAFF_ADS_TOKEN_ISSUE]);
    }

    public function test_a_disabled_staff_member_gets_no_token(): void
    {
        $target = StaffUser::factory()->superAdmin()->inactive()->create();

        $this->issueFor($target)
            ->assertStatus(422)
            ->assertJsonPath('errors.code.0', 'staff_not_active');
    }

    public function test_no_token_is_issued_when_the_hub_secret_is_missing(): void
    {
        config(['staff_ads.hub_secret' => null]);
        $target = StaffUser::factory()->superAdmin()->create();

        $this->issueFor($target)
            ->assertStatus(503)
            ->assertJsonPath('errors.code.0', 'ads_token_unavailable');
    }

    public function test_only_a_super_admin_can_request_a_token(): void
    {
        $agent = StaffUser::factory()->role('content_manager')->create();
        $target = StaffUser::factory()->role('content_manager')->create();

        $this->withToken($this->tokenFor($agent))
            ->postJson("/api/admin/staff/{$target->id}/ads-token")
            ->assertStatus(403);

        $this->assertDatabaseMissing('audit_logs', ['action' => AuditLog::STAFF_ADS_TOKEN_ISSUE]);
    }

    public function test_production_refuses_to_boot_without_the_hub_secret(): void
    {
        config(['staff_sync.main_url' => 'https://main.example.test', 'staff_sync.internal_token' => 'token', 'staff_ads.hub_secret' => null]);
        $this->app->detectEnvironment(fn () => 'production');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('ADS_STAFF_HUB_SECRET');

        (new AppServiceProvider($this->app))->boot();
    }

    /**
     * Copy of the ads backend's StaffHubTokenVerifier rules
     * (web/ads-backend/app/Services/Staff/StaffHubTokenVerifier.php), without the
     * replay cache. If the ads verifier changes, update this copy with it.
     *
     * @return array<string, mixed> the claims, or throws RuntimeException('invalid_staff_token')
     */
    private function verifyLikeAdsBackend(string $token, int $now, string $secret = self::SECRET): array
    {
        $fail = fn () => throw new RuntimeException('invalid_staff_token');

        $parts = explode('.', $token);
        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
            $fail();
        }
        [$encodedPayload, $signature] = $parts;

        if (! hash_equals(hash_hmac('sha256', $encodedPayload, $secret), strtolower($signature))) {
            $fail();
        }

        if (! preg_match('/^[A-Za-z0-9_-]+$/', $encodedPayload)) {
            $fail();
        }
        $decoded = base64_decode(strtr($encodedPayload, '-_', '+/').str_repeat('=', (4 - strlen($encodedPayload) % 4) % 4), true);
        $claims = json_decode((string) $decoded, true);
        if (! is_array($claims)) {
            $fail();
        }

        $iat = $claims['iat'] ?? null;
        $exp = $claims['exp'] ?? null;
        $sid = $claims['sid'] ?? null;
        $role = $claims['role'] ?? null;
        $jti = $claims['jti'] ?? null;

        if (($claims['v'] ?? null) !== 1
            || ($claims['typ'] ?? null) !== 'ads-staff'
            || ! is_int($iat) || ! is_int($exp)
            || ! is_string($sid) || $sid === '' || strlen($sid) > 64
            || ! is_string($jti) || ! preg_match('/^[A-Za-z0-9_-]{16,128}$/', $jti)
            || $iat > $now + 30
            || $exp - $iat > 300
            || $exp - $iat <= 0
            || $exp <= $now
        ) {
            $fail();
        }

        if (($claims['status'] ?? null) !== 'active' || ! is_string($role) || ! in_array($role, ['admin', 'moderator'], true)) {
            throw new RuntimeException('staff_not_active');
        }

        return $claims;
    }
}
