<?php

namespace App\Services\Otp;

use App\Models\PhoneOtpRequest;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

/**
 * Real Twilio Verify driver.
 *
 * Twilio Verify starts the verification and checks the user-entered code on our
 * behalf; the code itself is never stored or logged by us. Credentials are
 * runtime-only secrets from config/services.php (TWILIO_* env vars).
 */
class TwilioOtpDriver implements OtpDriverInterface
{
    private const BASE_URL = 'https://verify.twilio.com/v2';

    private Client $http;

    public function __construct()
    {
        $this->http = new Client([
            'timeout' => 15,
            'connect_timeout' => 10,
            'http_errors' => false,
        ]);
    }

    public function name(): string
    {
        return 'twilio';
    }

    public function start(PhoneOtpRequest $request): void
    {
        $serviceSid = (string) config('services.twilio.verify_service_sid');
        $accountSid = (string) config('services.twilio.account_sid');
        $authToken = (string) config('services.twilio.auth_token');

        if ($serviceSid === '' || $accountSid === '' || $authToken === '') {
            // Keep the *names* of the unset variables, not the empty values.
            $missing = array_keys(array_filter([
                'TWILIO_ACCOUNT_SID' => $accountSid,
                'TWILIO_AUTH_TOKEN' => $authToken,
                'TWILIO_VERIFY_SERVICE_SID' => $serviceSid,
            ], fn ($v) => $v === ''));

            Log::error('[phone-otp] Twilio Verify is not configured', [
                'missing_vars' => $missing,
                'otp_driver' => (string) config('services.twilio.otp_driver'),
                'environment' => app()->environment(),
            ]);

            // Name the missing variables so staging/local is actionable. The
            // generic message here was indistinguishable from a provider outage.
            throw new OtpProviderException(sprintf(
                'Twilio Verify is not configured (missing: %s). Set OTP_DRIVER=log to read codes from the log instead.',
                implode(', ', $missing),
            ));
        }

        $res = $this->http->post(self::BASE_URL."/Services/{$serviceSid}/Verifications", [
            'auth' => [$accountSid, $authToken],
            'form_params' => [
                'To' => $request->phone_e164,
                'Channel' => (string) config('services.twilio.channel', 'sms'),
            ],
        ]);

        $body = json_decode((string) $res->getBody(), true);

        if ($res->getStatusCode() >= 300 || ! is_array($body)) {
            $message = $body['message'] ?? 'Unknown Twilio error';
            Log::warning('[phone-otp] Twilio start verification failed', [
                'status' => $res->getStatusCode(),
                'message' => $message,
            ]);

            throw new OtpProviderException('The verification could not be sent. Please try again.');
        }

        $request->twilio_sid = (string) ($body['sid'] ?? '');
        $request->code_expires_at = now()->addMinutes((int) config('services.twilio.code_ttl', 10));
    }

    public function check(PhoneOtpRequest $request, string $code): array
    {
        $serviceSid = (string) config('services.twilio.verify_service_sid');
        $accountSid = (string) config('services.twilio.account_sid');
        $authToken = (string) config('services.twilio.auth_token');

        if ($serviceSid === '' || $accountSid === '' || $authToken === '') {
            // Keep the *names* of the unset variables, not the empty values.
            $missing = array_keys(array_filter([
                'TWILIO_ACCOUNT_SID' => $accountSid,
                'TWILIO_AUTH_TOKEN' => $authToken,
                'TWILIO_VERIFY_SERVICE_SID' => $serviceSid,
            ], fn ($v) => $v === ''));

            Log::error('[phone-otp] Twilio Verify is not configured', [
                'missing_vars' => $missing,
                'otp_driver' => (string) config('services.twilio.otp_driver'),
                'environment' => app()->environment(),
            ]);

            // Name the missing variables so staging/local is actionable. The
            // generic message here was indistinguishable from a provider outage.
            throw new OtpProviderException(sprintf(
                'Twilio Verify is not configured (missing: %s). Set OTP_DRIVER=log to read codes from the log instead.',
                implode(', ', $missing),
            ));
        }

        $res = $this->http->post(self::BASE_URL."/Services/{$serviceSid}/VerificationCheck", [
            'auth' => [$accountSid, $authToken],
            'form_params' => [
                'To' => $request->phone_e164,
                'Code' => $code,
            ],
        ]);

        $body = json_decode((string) $res->getBody(), true);

        if ($res->getStatusCode() >= 300 || ! is_array($body)) {
            Log::warning('[phone-otp] Twilio verification check failed', [
                'status' => $res->getStatusCode(),
            ]);

            throw new OtpProviderException('The verification could not be completed. Please try again.');
        }

        return match ($body['status'] ?? null) {
            'approved' => ['status' => 'approved'],
            'max_attempts_reached' => ['status' => 'max_attempts'],
            default => ['status' => 'denied'],
        };
    }
}
