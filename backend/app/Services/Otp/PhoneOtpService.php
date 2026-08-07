<?php

namespace App\Services\Otp;

use App\Jobs\SendSecurityLoginAlert;
use App\Models\Country;
use App\Models\PhoneOtpRequest;
use App\Models\RegistrationSession;
use App\Models\User;
use App\Services\AuthMethodConfigService;
use App\Services\AuthSessionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Orchestrates phone verification through a pluggable driver (Twilio Verify in
 * production, a log driver in local development/tests).
 *
 * Security properties:
 *  - OTP values are never logged (Twilio driver) and never stored in plaintext
 *  - per-number / per-IP / per-device rate limits + resend cooldown
 *  - generic responses that never reveal whether a number belongs to an account
 *  - every request is audited in the phone_otp_requests table
 */
class PhoneOtpService
{
    public function __construct(
        private readonly AuthMethodConfigService $methods,
        private readonly AuthSessionService $sessions,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function request(array $input, Request $request): array
    {
        $intent = (string) $input['intent'];

        if (! $this->methodEnabledForIntent($intent)) {
            throw ValidationException::withMessages([
                'phone' => ['Phone verification is currently disabled.'],
            ]);
        }

        $phone = $this->normalizePhone($input);
        $countryIso2 = $this->countryIso2($input, $phone);

        $this->assertDestinationAllowed($countryIso2);
        $this->assertRequestRateLimits($phone, $request);

        $remaining = $this->resendCooldownSeconds($phone);
        if ($remaining > 0) {
            throw ValidationException::withMessages([
                'phone' => ['Please wait a moment before requesting another code.'],
            ]);
        }

        $driver = $this->driver();
        $requiresChallenge = $this->requiresChallenge($request);

        $row = PhoneOtpRequest::create([
            'phone_e164' => $phone,
            'country_iso2' => $countryIso2,
            'intent' => $intent,
            'driver' => $driver->name(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'device_id' => $input['device_id'] ?? null,
            'status' => 'requested',
            'metadata' => [
                'channel' => $input['channel'] ?? config('services.twilio.channel', 'sms'),
                'requires_challenge' => $requiresChallenge,
            ],
        ]);

        try {
            $driver->start($row);
            $row->save();
        } catch (OtpProviderException $e) {
            $row->update(['status' => 'failed']);
            throw $e;
        }

        $this->bumpRequestCounters($phone, $request);

        return [
            'masked_phone' => $row->maskedPhone(),
            'verification_status' => 'pending',
            'expires_in_seconds' => (int) config('services.twilio.code_ttl', 10) * 60,
            'resend_after_seconds' => (int) config('services.twilio.resend_cooldown', 60),
            'channel' => $input['channel'] ?? config('services.twilio.channel', 'sms'),
            'requires_challenge' => $requiresChallenge,
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function verify(array $input, Request $request): array
    {
        $intent = (string) $input['intent'];

        if (! $this->methodEnabledForIntent($intent)) {
            throw ValidationException::withMessages([
                'phone' => ['Phone verification is currently disabled.'],
            ]);
        }

        $row = PhoneOtpRequest::where('phone_e164', $input['phone_e164'])
            ->where('intent', $intent)
            ->where('status', 'requested')
            ->latest('id')
            ->first();

        if (! $row) {
            throw ValidationException::withMessages([
                'code' => ['The verification code is invalid or has expired.'],
            ]);
        }

        if ($row->code_expires_at && $row->code_expires_at->isPast()) {
            $row->update(['status' => 'expired']);

            throw ValidationException::withMessages([
                'code' => ['The verification code has expired. Request a new code.'],
            ]);
        }

        $this->assertNotExceeded(
            'otp:ver:num:'.$row->phone_e164,
            (int) config('services.twilio.max_verify_attempts', 5),
            'Too many verification attempts. Please try again later.',
        );
        $this->bump('otp:ver:num:'.$row->phone_e164, 3600);

        $driver = $this->driver();
        $result = $driver->check($row, (string) $input['code']);

        if (($result['status'] ?? 'denied') !== 'approved') {
            $row->increment('attempts');
            if ($row->attempts >= (int) config('services.twilio.max_verify_attempts', 5)) {
                $row->update(['status' => 'failed']);
            }

            throw ValidationException::withMessages([
                'code' => ['The code you entered is incorrect or has expired.'],
            ]);
        }

        $row->update(['status' => 'verified']);
        PhoneOtpRequest::where('phone_e164', $row->phone_e164)
            ->where('intent', $intent)
            ->where('status', 'requested')
            ->where('id', '!=', $row->id)
            ->update(['status' => 'expired']);

        $user = User::where('mobile_number', $row->phone_e164)->first();
        if ($user && ! $user->hasVerifiedPhone()) {
            $user->update(['phone_verified_at' => now()]);
        }

        if ($intent === 'register') {
            return $this->registerVerified($input, $row, $user, $request);
        }

        return $this->loginVerified($input, $row, $user, $request);
    }

    /* ─────────────────────────── helpers ─────────────────────────── */

    private function methodEnabledForIntent(string $intent): bool
    {
        return $intent === 'login'
            ? $this->methods->loginEnabled('phone_otp')
            : $this->methods->registrationEnabled('phone_otp');
    }

    /**
     * @param  array<string, mixed>  $input
     */
    private function normalizePhone(array $input): string
    {
        if (! empty($input['phone_e164'])) {
            $phone = preg_replace('/[^\d+]/', '', (string) $input['phone_e164']) ?? '';

            if (! preg_match('/^\+[1-9]\d{1,14}$/', $phone)) {
                throw ValidationException::withMessages([
                    'phone_e164' => ['Enter a valid phone number.'],
                ]);
            }

            return $phone;
        }

        $iso = strtoupper((string) ($input['country_iso2'] ?? config('services.twilio.default_country', 'NG')));
        $country = Country::find($iso);

        if (! $country || ! $country->calling_code) {
            throw ValidationException::withMessages([
                'country_iso2' => ['This country is not supported.'],
            ]);
        }

        $local = preg_replace('/\D+/', '', (string) ($input['mobile_number'] ?? '')) ?? '';
        $local = ltrim($local, '0');

        if (strlen($local) < 6 || strlen($local) > 14) {
            throw ValidationException::withMessages([
                'mobile_number' => ['Enter a valid mobile number.'],
            ]);
        }

        return '+'.$country->calling_code.$local;
    }

    /**
     * @param  array<string, mixed>  $input
     */
    private function countryIso2(array $input, string $phone): string
    {
        if (! empty($input['country_iso2'])) {
            return strtoupper((string) $input['country_iso2']);
        }

        $cc = preg_replace('/\D+/', '', $phone) ?? '';
        foreach (str_split($cc) as $i => $_) {
            $prefix = substr($cc, 0, $i + 1);
            $country = Country::where('calling_code', $prefix)->first();
            if ($country) {
                return $country->iso2;
            }
        }

        return (string) config('services.twilio.default_country', 'NG');
    }

    private function assertDestinationAllowed(string $countryIso2): void
    {
        $blocked = (array) config('services.twilio.blocked_countries', []);

        if (in_array($countryIso2, $blocked, true)) {
            throw ValidationException::withMessages([
                'phone' => ['Verification is not available for this number.'],
            ]);
        }
    }

    private function assertRequestRateLimits(string $phone, Request $request): void
    {
        $this->assertNotExceeded(
            'otp:req:num:'.$phone,
            (int) config('services.twilio.max_per_number_per_hour', 5),
            'Too many verification requests for this number. Please try again later.',
        );
        $this->assertNotExceeded(
            'otp:req:ip:'.$request->ip(),
            (int) config('services.twilio.max_per_ip_per_hour', 10),
            'Too many verification requests. Please try again later.',
        );

        if ($request->input('device_id')) {
            $this->assertNotExceeded(
                'otp:req:dev:'.$request->input('device_id'),
                (int) config('services.twilio.max_per_device_per_hour', 10),
                'Too many verification requests from this device. Please try again later.',
            );
        }

        $this->assertNotExceeded(
            'otp:req:daily:'.$phone,
            (int) config('services.twilio.max_daily_per_number', 10),
            'Too many verification requests for this number today. Please try again later.',
        );
    }

    private function bumpRequestCounters(string $phone, Request $request): void
    {
        $this->bump('otp:req:num:'.$phone, 3600);
        $this->bump('otp:req:ip:'.$request->ip(), 3600);
        $this->bump('otp:req:daily:'.$phone, 86400);

        if ($request->input('device_id')) {
            $this->bump('otp:req:dev:'.$request->input('device_id'), 3600);
        }
    }

    private function resendCooldownSeconds(string $phone): int
    {
        $last = PhoneOtpRequest::where('phone_e164', $phone)
            ->where('status', 'requested')
            ->latest('id')
            ->first();

        if (! $last) {
            return 0;
        }

        $cooldown = (int) config('services.twilio.resend_cooldown', 60);

        return max(0, (int) now()->diffInSeconds($last->created_at->addSeconds($cooldown)));
    }

    private function requiresChallenge(Request $request): bool
    {
        $ipCount = (int) Cache::get('otp:req:ip:'.$request->ip(), 0);
        $limit = (int) config('services.twilio.max_per_ip_per_hour', 10);

        return $ipCount >= max(1, (int) ceil($limit / 2));
    }

    private function assertNotExceeded(string $key, int $limit, string $message): void
    {
        if ((int) Cache::get($key, 0) >= $limit) {
            throw ValidationException::withMessages(['phone' => [$message]]);
        }
    }

    private function bump(string $key, int $seconds): void
    {
        $next = (int) Cache::increment($key);
        Cache::put($key, $next, now()->addSeconds($seconds));
    }

    private function driver(): OtpDriverInterface
    {
        return match (config('services.twilio.otp_driver', 'log')) {
            'twilio' => app(TwilioOtpDriver::class),
            'log' => new LogOtpDriver,
            default => throw new OtpProviderException('Unknown OTP driver configured.'),
        };
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function registerVerified(array $input, PhoneOtpRequest $row, ?User $user, Request $request): array
    {
        if ($user) {
            throw ValidationException::withMessages([
                'phone' => ['An account already exists with this number. Sign in instead.'],
            ]);
        }

        $session = null;

        if (! empty($input['registration_session_id'])) {
            $session = RegistrationSession::where('token', $input['registration_session_id'])->first();

            if (! $session) {
                throw ValidationException::withMessages([
                    'registration_session_id' => ['Invalid registration session.'],
                ]);
            }

            if ($session->expires_at->isPast()) {
                $session->update(['verification_status' => 'expired']);

                throw ValidationException::withMessages([
                    'registration_session_id' => ['Registration session has expired.'],
                ]);
            }
        }

        if (! $session) {
            $session = RegistrationSession::create([
                'token' => Str::random(64),
                'phone_e164' => $row->phone_e164,
                'country_iso2' => $row->country_iso2,
                'verification_status' => 'verified',
                'expires_at' => now()->addMinutes(30),
                'device_id' => $input['device_id'] ?? null,
            ]);
        } else {
            $session->update([
                'verification_status' => 'verified',
                'attempt_count' => $session->attempt_count + 1,
            ]);
        }

        return [
            'verified' => true,
            'registration_session_id' => $session->token,
            'phone_e164' => $row->phone_e164,
            'country_iso2' => $row->country_iso2,
            'expires_in_seconds' => $session->expires_at->diffInSeconds(now()),
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function loginVerified(array $input, PhoneOtpRequest $row, ?User $user, Request $request): array
    {
        if (! $user) {
            return [
                'verified' => true,
                'account_exists' => false,
                'phone_e164' => $row->phone_e164,
            ];
        }

        if (in_array($user->status, ['suspended', 'banned'], true)) {
            throw ValidationException::withMessages([
                'phone' => ['This account is currently unavailable. Please contact support.'],
            ]);
        }

        $issued = $this->sessions->issue($user, $request);

        if ($issued['is_new_device']) {
            SendSecurityLoginAlert::dispatch($user, $request->ip(), $request->userAgent());
        }

        return [
            'verified' => true,
            'account_exists' => true,
            'is_new_device' => $issued['is_new_device'],
            'token' => $issued['token'],
            'user' => $this->sessions->userPayload($user),
        ];
    }
}
