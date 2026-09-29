<?php

namespace Tests\Feature;

use App\Models\DeviceSession;
use App\Models\PhoneOtpRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Staging runs the 'log' OTP driver so codes are readable in the log (or
 * delivered to an already-logged-in device) instead of sending real SMS.
 *
 * Log assertions read a real log file rather than a spy: a spy cannot prove a
 * message was *not* written, and "never leak the code in production" is exactly
 * the property that matters here.
 */
class OtpStagingDriverTest extends TestCase
{
    use RefreshDatabase;

    private string $logPath;

    protected function setUp(): void
    {
        parent::setUp();

        $this->logPath = sys_get_temp_dir().'/otp-test-'.getmypid().'.log';
        @unlink($this->logPath);

        config([
            'logging.default' => 'single',
            'logging.channels.single' => [
                'driver' => 'single',
                'path' => $this->logPath,
                'level' => 'debug',
            ],
        ]);
    }

    protected function tearDown(): void
    {
        @unlink($this->logPath);
        parent::tearDown();
    }

    private function logContents(): string
    {
        return is_file($this->logPath) ? (string) file_get_contents($this->logPath) : '';
    }

    private function sendOtp(string $phone = '+2348012345678'): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/v1/auth/otp/request', [
            'intent' => 'login',
            'phone_e164' => $phone,
        ]);
    }

    private function loginUserWithActiveDevice(string $phone): User
    {
        $user = User::factory()->create(['mobile_number' => $phone]);
        // A normal login only ever creates a Sanctum personal access token; no
        // DeviceSession row is involved, so the helper must reflect that shape.
        $user->createToken('active-web-session')->accessToken->forceFill(['last_used_at' => now()])->save();

        return $user;
    }

    /**
     * A set-but-blank OTP_DRIVER= makes env() return "", not the default, which
     * fell through match() to `default` and produced a 503 on every request.
     */
    public function test_blank_otp_driver_falls_back_to_log_instead_of_erroring(): void
    {
        config(['services.twilio.otp_driver' => '']);

        $this->sendOtp()->assertOk();

        $this->assertDatabaseHas('phone_otp_requests', ['driver' => 'log']);
    }

    public function test_explicitly_blank_otp_driver_is_not_coerced_to_twilio_in_production(): void
    {
        // CodeRabbit caught the config defaulting a *blank* driver to twilio
        // under APP_ENV=production before PhoneOtpService::driver() could
        // normalize it to log. The default must only apply when unset.
        $backup = [$_ENV['OTP_DRIVER'] ?? null, $_ENV['APP_ENV'] ?? null, $_SERVER['OTP_DRIVER'] ?? null, $_SERVER['APP_ENV'] ?? null];
        $_ENV['OTP_DRIVER'] = $_SERVER['OTP_DRIVER'] = '';
        $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = 'production';

        try {
            $services = require base_path('config/services.php');

            $this->assertSame('', $services['twilio']['otp_driver']);
        } finally {
            foreach (['OTP_DRIVER', 'APP_ENV'] as $key) {
                unset($_ENV[$key], $_SERVER[$key]);
            }
            if ($backup[0] !== null) $_ENV['OTP_DRIVER'] = $backup[0];
            if ($backup[1] !== null) $_ENV['APP_ENV'] = $backup[1];
            if ($backup[2] !== null) $_SERVER['OTP_DRIVER'] = $backup[2];
            if ($backup[3] !== null) $_SERVER['APP_ENV'] = $backup[3];
        }
    }

    public function test_whitespace_and_uppercase_driver_names_are_normalised(): void
    {
        config(['services.twilio.otp_driver' => '  LOG  ']);

        $this->sendOtp()->assertOk();
        $this->assertDatabaseHas('phone_otp_requests', ['driver' => 'log']);
    }

    public function test_genuinely_unknown_driver_still_errors_and_names_itself(): void
    {
        config(['services.twilio.otp_driver' => 'carrier-pigeon']);

        $res = $this->sendOtp()->assertStatus(503);

        $this->assertSame(
            "Unknown OTP driver configured: 'carrier-pigeon'.",
            $res->json('errors.debug_reason'),
        );
    }

    public function test_log_driver_writes_a_six_digit_code_to_the_log(): void
    {
        config(['services.twilio.otp_driver' => 'log']);

        $this->sendOtp()->assertOk();

        $this->assertMatchesRegularExpression(
            '/dev driver verification requested.*code.{0,40}"?\d{6}/s',
            $this->logContents(),
        );
    }

    /**
     * The log driver previously threw a bare RuntimeException in production,
     * which the controller did not catch, so it surfaced as an opaque 500.
     */
    public function test_log_driver_is_refused_in_production_and_never_leaks_the_code(): void
    {
        config(['services.twilio.otp_driver' => 'log']);
        $this->app['env'] = 'production';

        $res = $this->sendOtp()->assertStatus(503);

        // The reason is an operator aid and must not leak to clients in prod.
        $res->assertJsonMissingPath('errors.debug_reason');
        $this->assertStringContainsString('never be used in production', $this->logContents());
        $this->assertStringNotContainsString('dev driver verification requested', $this->logContents());
    }

    public function test_log_driver_can_be_allowed_in_production_explicitly(): void
    {
        config(['services.twilio.otp_driver' => 'log']);
        config(['services.twilio.allow_log_driver' => true]);
        $this->app['env'] = 'production';

        $this->sendOtp()->assertOk();
    }

    public function test_twilio_driver_names_the_missing_variables(): void
    {
        config([
            'services.twilio.otp_driver' => 'twilio',
            'services.twilio.account_sid' => '',
            'services.twilio.auth_token' => '',
            'services.twilio.verify_service_sid' => '',
        ]);

        $res = $this->sendOtp()->assertStatus(503);
        $reason = (string) $res->json('errors.debug_reason');

        $this->assertStringContainsString('TWILIO_ACCOUNT_SID', $reason);
        $this->assertStringContainsString('TWILIO_AUTH_TOKEN', $reason);
        $this->assertStringContainsString('TWILIO_VERIFY_SERVICE_SID', $reason);
        $this->assertStringContainsString('OTP_DRIVER=log', $reason);
    }

    public function test_twilio_driver_does_not_claim_present_variables_are_missing(): void
    {
        config([
            'services.twilio.otp_driver' => 'twilio',
            'services.twilio.account_sid' => 'ACtest',
            'services.twilio.auth_token' => '',
            'services.twilio.verify_service_sid' => 'VAset',
        ]);

        $reason = (string) $this->sendOtp()->assertStatus(503)->json('errors.debug_reason');

        $this->assertStringContainsString('TWILIO_AUTH_TOKEN', $reason);
        $this->assertStringNotContainsString('TWILIO_ACCOUNT_SID', $reason);
        $this->assertStringNotContainsString('TWILIO_VERIFY_SERVICE_SID', $reason);
    }

    public function test_debug_reason_is_never_returned_in_production(): void
    {
        config(['services.twilio.otp_driver' => 'carrier-pigeon']);
        $this->app['env'] = 'production';

        $this->sendOtp()->assertStatus(503)->assertJsonMissingPath('errors.debug_reason');
    }

    /**
     * The in-app path delivers to an already-logged-in device. Staging testers
     * also need the code in the log when no other device is signed in.
     */
    public function test_in_app_active_device_code_is_delivered_and_also_logged_in_staging(): void
    {
        $this->loginUserWithActiveDevice('+2348012345678');

        $this->sendOtp()->assertOk()->assertJsonPath('data.channel', 'in_app_active_device');

        $row = PhoneOtpRequest::latest('id')->first();
        $this->assertSame('in_app_active_device', $row->driver);

        // The in-app code must be readable in the log for staging testing...
        $this->assertStringContainsString('in-app active-device code issued', $this->logContents());
        // ...and must still verify normally.
        $this->assertNotNull(Cache::get('phone-otp:dev:'.$row->id));
    }

    public function test_in_app_code_is_never_logged_in_production(): void
    {
        $this->loginUserWithActiveDevice('+2348012345678');
        $this->app['env'] = 'production';

        $this->sendOtp()->assertOk()->assertJsonPath('data.channel', 'in_app_active_device');

        $this->assertStringNotContainsString(
            'in-app active-device code issued',
            $this->logContents(),
        );
    }

    /**
     * Staging commonly reports APP_ENV=production while still needing readable
     * codes. OTP_ALLOW_LOG_DRIVER=true (the same knob LogOtpDriver honours)
     * must let the in-app path write the code to the log too.
     */
    public function test_in_app_code_is_logged_in_production_when_explicitly_allowed(): void
    {
        $this->loginUserWithActiveDevice('+2348012345678');
        config(['services.twilio.allow_log_driver' => true]);
        $this->app['env'] = 'production';

        $this->sendOtp()->assertOk()->assertJsonPath('data.channel', 'in_app_active_device');

        $this->assertStringContainsString(
            'in-app active-device code issued',
            $this->logContents(),
        );
    }

    public function test_any_recently_used_login_session_receives_the_inapp_code(): void
    {
        // Regression: ordinary web/app logins never create a DeviceSession row,
        // so the old "trusted device session only" check silently disabled the
        // active-device flow for everyone but device-approval users.
        $user = User::factory()->create(['mobile_number' => '+2348099887766']);
        $user->createToken('web-session')->accessToken->forceFill(['last_used_at' => now()])->save();

        $this->sendOtp('+2348099887766')
            ->assertOk()
            ->assertJsonPath('data.channel', 'in_app_active_device');

        $this->assertDatabaseHas('phone_otp_requests', ['driver' => 'in_app_active_device']);
    }

    public function test_untrusted_but_recently_active_session_still_receives_the_inapp_code(): void
    {
        $user = User::factory()->create(['mobile_number' => '+2348012345678']);
        DeviceSession::create([
            'user_id' => $user->id,
            'device_id' => 'untrusted-web',
            'platform' => 'web',
            'is_trusted' => false,
            'last_active_at' => now(),
        ]);

        $this->sendOtp()->assertOk()->assertJsonPath('data.channel', 'in_app_active_device');
    }

    public function test_stale_session_falls_back_to_the_sms_driver(): void
    {
        $user = User::factory()->create(['mobile_number' => '+2348077665544']);
        $token = $user->createToken('old-session')->accessToken;
        $token->forceFill([
            'last_used_at' => now()->subDays(60),
            'created_at' => now()->subDays(60),
        ])->save();

        $this->sendOtp('+2348077665544')->assertOk()->assertJsonPath('data.channel', 'sms');
        $this->assertDatabaseHas('phone_otp_requests', ['driver' => 'log']);
    }

    public function test_in_app_path_is_skipped_when_the_caller_forces_sms(): void
    {
        $this->loginUserWithActiveDevice('+2348012345678');

        $this->postJson('/api/v1/auth/otp/request', [
            'intent' => 'login',
            'phone_e164' => '+2348012345678',
            'force_sms' => true,
        ])->assertOk()->assertJsonPath('data.channel', 'sms');
    }
}
