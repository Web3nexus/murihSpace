<?php

namespace Tests\Feature;

use App\Models\Country;
use App\Models\PhoneOtpRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PhoneOtpAuthTest extends TestCase
{
    use RefreshDatabase;

    private const NG_NUMBER = '+2348123456789';

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.twilio.otp_driver' => 'log']);
        config(['services.twilio.resend_cooldown' => 60]);
        config(['services.twilio.max_per_number_per_hour' => 5]);
        config(['services.twilio.max_per_ip_per_hour' => 10]);
        config(['services.twilio.max_daily_per_number' => 10]);
        config(['services.twilio.max_verify_attempts' => 5]);

        Country::create([
            'iso2' => 'NG',
            'iso3' => 'NGA',
            'name' => 'Nigeria',
            'calling_code' => '234',
            'flag' => '🇳🇬',
            'currency' => 'NGN',
        ]);
    }

    private function otpCode(string $phone): string
    {
        $row = PhoneOtpRequest::where('phone_e164', $phone)->latest('id')->firstOrFail();

        return (string) Cache::get('phone-otp:dev:'.$row->id);
    }

    private function requestOtp(string $intent, array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/v1/auth/otp/request', array_merge([
            'intent' => $intent,
            'phone_e164' => self::NG_NUMBER,
        ], $extra));
    }

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'super_admin',
        ]);
    }

    /* ─────────────────────────── registration ─────────────────────────── */

    public function test_phone_first_registration_flow(): void
    {
        $req = $this->requestOtp('register', ['country_iso2' => 'NG', 'mobile_number' => '8123456789']);
        $req->assertOk()
            ->assertJsonPath('data.verification_status', 'pending')
            ->assertJsonMissing(['data.account_exists']);

        $code = $this->otpCode(self::NG_NUMBER);

        $verify = $this->postJson('/api/v1/auth/otp/verify', [
            'intent' => 'register',
            'phone_e164' => self::NG_NUMBER,
            'code' => $code,
        ]);

        $verify->assertOk()->assertJsonPath('data.verified', true);
        $sessionId = $verify->json('data.registration_session_id');
        $this->assertNotEmpty($sessionId);

        $register = $this->postJson('/api/v1/auth/register', [
            'registration_session_id' => $sessionId,
            'name' => 'Ada Nwosu',
            'username' => 'ada_nwosu',
            'password' => 'Str0ng#Pass1',
            'password_confirmation' => 'Str0ng#Pass1',
            'role' => 'member',
        ]);

        $register->assertStatus(201)
            ->assertJsonPath('data.user.phone_verified', true)
            ->assertJsonPath('data.user.mobile_number', self::NG_NUMBER);

        $this->assertDatabaseHas('users', [
            'username' => 'ada_nwosu',
            'mobile_number' => self::NG_NUMBER,
            'country' => 'NG',
        ]);

        $this->assertDatabaseHas('registration_sessions', [
            'token' => $sessionId,
            'verification_status' => 'consumed',
        ]);
    }

    public function test_multiple_registrations_without_email_or_with_empty_email_store_null(): void
    {
        // 1st User: empty string email
        $this->requestOtp('register', ['country_iso2' => 'NG', 'mobile_number' => '8123456789'])->assertOk();
        $code1 = $this->otpCode(self::NG_NUMBER);
        $v1 = $this->postJson('/api/v1/auth/otp/verify', ['intent' => 'register', 'phone_e164' => self::NG_NUMBER, 'code' => $code1]);
        $s1 = $v1->json('data.registration_session_id');

        $reg1 = $this->postJson('/api/v1/auth/register', [
            'registration_session_id' => $s1,
            'name' => 'User One',
            'username' => 'user_one',
            'email' => '',
            'password' => 'Str0ng#Pass1',
            'password_confirmation' => 'Str0ng#Pass1',
            'role' => 'member',
        ]);
        $reg1->assertStatus(201);

        $u1 = User::where('username', 'user_one')->firstOrFail();
        $this->assertNull($u1->email);

        // 2nd User: null email with different phone
        $phone2 = '+2348099998888';
        $this->postJson('/api/v1/auth/otp/request', ['intent' => 'register', 'phone_e164' => $phone2, 'country_iso2' => 'NG', 'mobile_number' => '8099998888'])->assertOk();
        $code2 = $this->otpCode($phone2);
        $v2 = $this->postJson('/api/v1/auth/otp/verify', ['intent' => 'register', 'phone_e164' => $phone2, 'code' => $code2]);
        $s2 = $v2->json('data.registration_session_id');

        $reg2 = $this->postJson('/api/v1/auth/register', [
            'registration_session_id' => $s2,
            'name' => 'User Two',
            'username' => 'user_two',
            'email' => null,
            'password' => 'Str0ng#Pass1',
            'password_confirmation' => 'Str0ng#Pass1',
            'role' => 'member',
        ]);
        $reg2->assertStatus(201);

        $u2 = User::where('username', 'user_two')->firstOrFail();
        $this->assertNull($u2->email);
    }

    public function test_registration_requires_verified_session(): void
    {
        $register = $this->postJson('/api/v1/auth/register', [
            'registration_session_id' => 'not-a-real-session',
            'name' => 'No OTP',
            'username' => 'no_otp_user',
            'password' => 'Str0ng#Pass1',
            'password_confirmation' => 'Str0ng#Pass1',
            'role' => 'member',
        ]);

        $register->assertStatus(422)->assertJsonValidationErrors('registration_session_id');
    }

    public function test_duplicate_phone_cannot_register_again(): void
    {
        User::factory()->create(['mobile_number' => self::NG_NUMBER, 'phone_verified_at' => now()]);

        $this->requestOtp('register')->assertOk();
        $code = $this->otpCode(self::NG_NUMBER);

        $verify = $this->postJson('/api/v1/auth/otp/verify', [
            'intent' => 'register',
            'phone_e164' => self::NG_NUMBER,
            'code' => $code,
        ]);

        $verify->assertStatus(422)->assertJsonValidationErrors('phone');
    }

    /* ────────────────────────────── login ─────────────────────────────── */

    public function test_otp_login_flow(): void
    {
        $user = User::factory()->create(['mobile_number' => self::NG_NUMBER]);

        $this->requestOtp('login')->assertOk();
        $code = $this->otpCode(self::NG_NUMBER);

        $verify = $this->postJson('/api/v1/auth/otp/verify', [
            'intent' => 'login',
            'phone_e164' => self::NG_NUMBER,
            'code' => $code,
        ]);

        $verify->assertOk()
            ->assertJsonPath('data.verified', true)
            ->assertJsonPath('data.account_exists', true)
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.user.phone_verified', true);

        $this->assertNotEmpty($verify->json('data.token'));
        $this->assertNotNull($user->refresh()->phone_verified_at);
    }

    public function test_otp_login_unknown_number_does_not_reveal_account(): void
    {
        $this->requestOtp('login')->assertOk()->assertJsonMissing(['data.account_exists']);

        $code = $this->otpCode(self::NG_NUMBER);

        $this->postJson('/api/v1/auth/otp/verify', [
            'intent' => 'login',
            'phone_e164' => self::NG_NUMBER,
            'code' => $code,
        ])->assertOk()
            ->assertJsonPath('data.verified', true)
            ->assertJsonPath('data.account_exists', false)
            ->assertJsonMissing(['data.token']);
    }

    public function test_new_device_login_sends_security_alert(): void
    {
        $user = User::factory()->create(['mobile_number' => self::NG_NUMBER]);

        $this->requestOtp('login')->assertOk();
        $this->postJson('/api/v1/auth/otp/verify', [
            'intent' => 'login',
            'phone_e164' => self::NG_NUMBER,
            'code' => $this->otpCode(self::NG_NUMBER),
        ])->assertOk()->assertJsonPath('data.is_new_device', true);

        $this->assertDatabaseHas('notifications', [
            'type' => 'new_device_login',
        ]);
    }

    /* ────────────────────────── failure states ────────────────────────── */

    public function test_invalid_otp_is_rejected(): void
    {
        $this->requestOtp('login')->assertOk();

        $this->postJson('/api/v1/auth/otp/verify', [
            'intent' => 'login',
            'phone_e164' => self::NG_NUMBER,
            'code' => '000000',
        ])->assertStatus(422)->assertJsonValidationErrors('code');
    }

    public function test_expired_otp_is_rejected(): void
    {
        $this->requestOtp('login')->assertOk();
        PhoneOtpRequest::where('phone_e164', self::NG_NUMBER)->update(['code_expires_at' => now()->subMinute()]);

        $this->postJson('/api/v1/auth/otp/verify', [
            'intent' => 'login',
            'phone_e164' => self::NG_NUMBER,
            'code' => $this->otpCode(self::NG_NUMBER),
        ])->assertStatus(422)->assertJsonValidationErrors('code');
    }

    public function test_resend_respects_cooldown(): void
    {
        $this->requestOtp('login')->assertOk();

        $this->requestOtp('login')->assertStatus(422);
    }

    public function test_per_number_rate_limit(): void
    {
        config(['services.twilio.max_per_number_per_hour' => 2]);
        config(['services.twilio.resend_cooldown' => 0]);

        $this->requestOtp('login')->assertOk();
        $this->requestOtp('login')->assertOk();
        $this->requestOtp('login')->assertStatus(422);
    }

    public function test_per_ip_rate_limit(): void
    {
        config(['services.twilio.max_per_ip_per_hour' => 2]);
        config(['services.twilio.resend_cooldown' => 0]);

        foreach (['+2348011111111', '+2348022222222'] as $phone) {
            $this->postJson('/api/v1/auth/otp/request', [
                'intent' => 'login',
                'phone_e164' => $phone,
            ])->assertOk();
        }

        $this->postJson('/api/v1/auth/otp/request', [
            'intent' => 'login',
            'phone_e164' => '+2348033333333',
        ])->assertStatus(422);
    }

    public function test_blocked_country_is_rejected(): void
    {
        config(['services.twilio.blocked_countries' => ['NG']]);

        $this->postJson('/api/v1/auth/otp/request', [
            'intent' => 'login',
            'phone_e164' => self::NG_NUMBER,
        ])->assertStatus(422);
    }

    /* ───────────────────────── auth method config ─────────────────────── */

    public function test_public_auth_methods_endpoint_shape(): void
    {
        $res = $this->getJson('/api/v1/auth/methods');
        $res->assertOk();

        $data = $res->json('data') ?? $res->json();
        $this->assertSame('phone_otp', $data['primary']);
        $this->assertArrayHasKey('phone_otp', $data['methods']);
        $this->assertArrayHasKey('email_password', $data['methods']);
        $this->assertIsBool($data['methods']['phone_otp']['login']);
        $this->assertIsBool($data['methods']['phone_otp']['registration']);
        $this->assertArrayNotHasKey('client_secret', $data['methods']['google'] ?? []);
    }

    public function test_email_password_login_can_be_disabled(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/securegate/auth/methods', [
            'primary' => 'phone_otp',
            'methods' => [
                'email_password' => ['login' => false],
            ],
        ])->assertOk();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'x@example.com',
            'password' => 'Whatever1!',
        ])->assertStatus(422);
    }

    public function test_email_password_registration_can_be_disabled(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/securegate/auth/methods', [
            'primary' => 'phone_otp',
            'methods' => [
                'email_password' => ['registration' => false],
            ],
        ])->assertOk();

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Blocked',
            'email' => 'blocked@example.com',
            'username' => 'blocked_user',
            'password' => 'Str0ng#Pass1',
            'password_confirmation' => 'Str0ng#Pass1',
            'role' => 'member',
        ])->assertStatus(422);
    }

    public function test_at_least_one_login_method_must_remain_enabled(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/securegate/auth/methods', [
            'primary' => 'phone_otp',
            'methods' => [
                'phone_otp' => ['login' => false],
                'email_password' => ['login' => false],
                'google' => ['login' => false],
                'apple' => ['login' => false],
                'passkey' => ['login' => false],
            ],
        ])->assertStatus(422);
    }

    public function test_phone_otp_and_email_login_cannot_both_be_disabled(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/securegate/auth/methods', [
            'primary' => 'google',
            'methods' => [
                'phone_otp' => ['login' => false],
                'email_password' => ['login' => false],
                'google' => ['login' => true],
            ],
        ])->assertStatus(422);
    }

    public function test_auth_method_change_is_audited(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/securegate/auth/methods', [
            'primary' => 'phone_otp',
            'methods' => [
                'email_password' => ['login' => false],
            ],
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'auth.methods.updated',
            'user_id' => $admin->id,
        ]);
    }

    /* ─────────────────────────── facebook removal ─────────────────────── */

    public function test_facebook_login_is_unavailable(): void
    {
        $this->getJson('/api/v1/auth/social/facebook/redirect')
            ->assertStatus(400);
    }

    public function test_facebook_accounts_are_preserved_by_migration(): void
    {
        $migration = require base_path('database/migrations/2026_08_04_000013_migrate_facebook_accounts.php');

        $user = User::factory()->create(['email_verified_at' => null]);
        $user->update(['provider' => 'facebook', 'provider_id' => 'fb_123']);

        $migration->up();

        $user->refresh();
        $this->assertNull($user->provider);
        $this->assertNull($user->provider_id);
        $this->assertNotNull($user->email_verified_at);
        $this->assertDatabaseHas('users', ['id' => $user->id]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'auth.facebook_removed',
            'resource_id' => (string) $user->id,
        ]);
    }
}
