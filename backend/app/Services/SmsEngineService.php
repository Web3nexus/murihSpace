<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Support\LogRedactor;
use Exception;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

/**
 * Configurable SMS engine. Mirrors MailEngineService: an admin chooses a
 * transport (twilio or log) and supplies credentials which are stored in
 * AdminSetting, encrypted at rest, and never exposed again. Secrets are only
 * ever available at runtime via apply()/send().
 */
class SmsEngineService
{
    private const TWILIO_VERIFY_BASE_URL = 'https://verify.twilio.com/v2/Services';

    private const TWILIO_BASE_URL = 'https://api.twilio.com/2010-04-01/Accounts';

    private const SECRET_FIELDS = ['auth_token'];

    private Client $http;

    public function __construct(?Client $http = null)
    {
        $this->http = $http ?? new Client([
            'timeout' => 15,
            'connect_timeout' => 10,
            'http_errors' => false,
        ]);
    }

    public function transports(): array
    {
        return ['twilio', 'log'];
    }

    public function selected(): string
    {
        $defaultDriver = config('services.twilio.otp_driver') ?: config('services.sms.driver', 'log');
        $selected = strtolower(trim((string) AdminSetting::get('sms_engine', $defaultDriver)));

        return in_array($selected, $this->transports(), true) ? $selected : 'log';
    }

    public function setSelected(string $transport): void
    {
        if (! in_array($transport, $this->transports(), true)) {
            return;
        }

        AdminSetting::set('sms_engine', $transport);
    }

    /**
     * Effective settings for the admin UI. Never exposes secrets.
     */
    public function metadata(): array
    {
        return [
            'transport' => $this->selected(),
            'default_transport' => config('services.sms.driver', 'log'),
            'twilio' => [
                'account_sid' => $this->stored('account_sid') ?? config('services.twilio.account_sid') ?? config('services.sms.account_sid'),
                'verify_service_sid' => $this->stored('verify_service_sid') ?? config('services.twilio.verify_service_sid') ?? config('services.sms.verify_service_sid'),
                'channel' => $this->stored('channel') ?? config('services.twilio.channel', 'sms'),
                'from_number' => $this->stored('from_number') ?? config('services.sms.from_number'),
                'has_auth_token' => $this->hasStored('auth_token') || (bool) config('services.twilio.auth_token') || (bool) config('services.sms.auth_token'),
            ],
        ];
    }

    public function update(array $data): void
    {
        if (isset($data['transport'])) {
            $this->setSelected($data['transport']);
        }

        foreach (['account_sid', 'verify_service_sid', 'channel', 'from_number'] as $field) {
            if (array_key_exists($field, $data)) {
                AdminSetting::set('sms_engine_' . $field, trim((string) $data[$field]));
            }
        }

        if (isset($data['auth_token']) && trim((string) $data['auth_token']) !== '') {
            AdminSetting::set('sms_engine_auth_token', Crypt::encryptString(trim((string) $data['auth_token'])));
        }

        $this->apply();
    }

    /**
     * Push stored settings into the runtime config so both SmsEngineService
     * and PhoneOtpService / TwilioOtpDriver pick them up.
     */
    public function apply(): void
    {
        $rawTransport = AdminSetting::get('sms_engine');
        if ($rawTransport !== null && in_array($rawTransport, $this->transports(), true)) {
            config([
                'services.sms.driver' => $rawTransport,
                'services.twilio.otp_driver' => $rawTransport,
            ]);
        }

        if (($sid = $this->stored('account_sid')) !== null) {
            config([
                'services.sms.account_sid' => $sid,
                'services.twilio.account_sid' => $sid,
            ]);
        }
        if (($token = $this->stored('auth_token')) !== null) {
            config([
                'services.sms.auth_token' => $token,
                'services.twilio.auth_token' => $token,
            ]);
        }
        if (($verifySid = $this->stored('verify_service_sid')) !== null) {
            config([
                'services.sms.verify_service_sid' => $verifySid,
                'services.twilio.verify_service_sid' => $verifySid,
            ]);
        }
        if (($channel = $this->stored('channel')) !== null) {
            config([
                'services.sms.channel' => $channel,
                'services.twilio.channel' => $channel,
            ]);
        }
        if (($from = $this->stored('from_number')) !== null) {
            config(['services.sms.from_number' => $from]);
        }
    }

    /**
     * Start a Twilio Verify verification (`/v2/Services/{Sid}/Verifications`)
     * or write a verification challenge to the log when the `log` transport is selected.
     *
     * @throws \RuntimeException
     */
    public function startVerification(string $to, ?string $fallbackCode = null, ?string $channel = null): string
    {
        if (trim($to) === '') {
            throw new \InvalidArgumentException('Recipient phone number is required.');
        }

        $this->apply();

        if ($this->selected() !== 'twilio') {
            $body = $fallbackCode !== null
                ? "Your MurihSpace verification code is: {$fallbackCode}. Valid for 10 minutes."
                : 'MurihSpace verification triggered.';

            return $this->sendViaLog($to, $body);
        }

        return $this->startTwilioVerify($to, $channel);
    }

    /**
     * Check a user-entered OTP code against Twilio Verify (`/v2/Services/{Sid}/VerificationCheck`).
     *
     * @throws \RuntimeException
     */
    public function checkVerification(string $to, string $code): bool
    {
        if (trim($to) === '' || trim($code) === '') {
            return false;
        }

        $this->apply();

        $accountSid = (string) (config('services.twilio.account_sid') ?: config('services.sms.account_sid'));
        $authToken = (string) (config('services.twilio.auth_token') ?: config('services.sms.auth_token'));
        $verifyServiceSid = (string) (config('services.twilio.verify_service_sid') ?: config('services.sms.verify_service_sid'));

        if ($accountSid === '' || $authToken === '' || $verifyServiceSid === '') {
            throw new \RuntimeException('Twilio Verify is not configured. Set an Account SID, Auth Token, and Verify Service SID (TWILIO_VERIFY_SERVICE_SID).');
        }

        $res = $this->http->post(self::TWILIO_VERIFY_BASE_URL . '/' . $verifyServiceSid . '/VerificationCheck', [
            'auth' => [$accountSid, $authToken],
            'form_params' => [
                'To' => $to,
                'Code' => trim($code),
            ],
        ]);

        $parsed = json_decode((string) $res->getBody(), true);

        if ($res->getStatusCode() >= 300 || ! is_array($parsed)) {
            $error = $parsed['message'] ?? 'Unknown Twilio Verify error';
            Log::warning('[sms-engine] Twilio Verify check failed', [
                'status' => $res->getStatusCode(),
                'message' => $error,
            ]);

            return false;
        }

        return ($parsed['status'] ?? null) === 'approved';
    }

    /**
     * Send a verification or SMS through the selected transport. Returns the provider
     * verification/message SID when known. Throws on hard configuration failures so callers
     * can report meaningful errors.
     *
     * @throws \RuntimeException
     */
    public function send(string $to, string $body = ''): ?string
    {
        if (trim($to) === '') {
            throw new \InvalidArgumentException('Recipient phone number is required.');
        }

        $this->apply();

        return match ($this->selected()) {
            'twilio' => $this->sendViaTwilio($to, $body),
            default => $this->sendViaLog($to, $body !== '' ? $body : 'Verification dispatched.'),
        };
    }

    private function startTwilioVerify(string $to, ?string $channel = null): string
    {
        $accountSid = (string) (config('services.twilio.account_sid') ?: config('services.sms.account_sid'));
        $authToken = (string) (config('services.twilio.auth_token') ?: config('services.sms.auth_token'));
        $verifyServiceSid = (string) (config('services.twilio.verify_service_sid') ?: config('services.sms.verify_service_sid'));
        $resolvedChannel = $channel ?: (string) (config('services.twilio.channel') ?: config('services.sms.channel', 'sms'));

        if ($accountSid === '' || $authToken === '' || $verifyServiceSid === '') {
            throw new \RuntimeException('Twilio Verify is not configured. Set an Account SID, Auth Token, and Verify Service SID (TWILIO_VERIFY_SERVICE_SID).');
        }

        $res = $this->http->post(self::TWILIO_VERIFY_BASE_URL . '/' . $verifyServiceSid . '/Verifications', [
            'auth' => [$accountSid, $authToken],
            'form_params' => [
                'To' => $to,
                'Channel' => $resolvedChannel ?: 'sms',
            ],
        ]);

        $parsed = json_decode((string) $res->getBody(), true);

        if ($res->getStatusCode() >= 300 || ! is_array($parsed)) {
            $error = $parsed['message'] ?? 'Unknown Twilio Verify error';
            Log::warning('[sms-engine] Twilio Verify start failed', [
                'status' => $res->getStatusCode(),
                'message' => $error,
            ]);

            throw new \RuntimeException('Could not send the verification via Twilio Verify: ' . $error);
        }

        return (string) ($parsed['sid'] ?? '');
    }

    private function sendViaTwilio(string $to, string $body): string
    {
        $verifyServiceSid = (string) (config('services.twilio.verify_service_sid') ?: config('services.sms.verify_service_sid'));
        $from = (string) config('services.sms.from_number');

        // Primary path: Twilio Verify API (/v2/Services/{Sid}/Verifications)
        if ($verifyServiceSid !== '' || $from === '') {
            return $this->startTwilioVerify($to);
        }

        // Legacy fallback only when Verify Service SID is unset and a From number is explicitly provided
        $accountSid = (string) (config('services.twilio.account_sid') ?: config('services.sms.account_sid'));
        $authToken = (string) (config('services.twilio.auth_token') ?: config('services.sms.auth_token'));

        if ($accountSid === '' || $authToken === '') {
            throw new \RuntimeException('Twilio Verify is not configured. Set an Account SID, Auth Token, and Verify Service SID (TWILIO_VERIFY_SERVICE_SID).');
        }

        $res = $this->http->post(self::TWILIO_BASE_URL . '/' . $accountSid . '/Messages.json', [
            'auth' => [$accountSid, $authToken],
            'form_params' => [
                'To' => $to,
                'From' => $from,
                'Body' => $body,
            ],
        ]);

        $parsed = json_decode((string) $res->getBody(), true);

        if ($res->getStatusCode() >= 300 || ! is_array($parsed)) {
            $error = $parsed['message'] ?? 'Unknown Twilio error';
            Log::warning('[sms-engine] Twilio send failed', [
                'status' => $res->getStatusCode(),
                'message' => $error,
            ]);

            throw new \RuntimeException('Could not send the SMS message.');
        }

        return (string) ($parsed['sid'] ?? '');
    }

    private function sendViaLog(string $to, string $body): string
    {
        $sid = 'LOG-' . strtoupper(bin2hex(random_bytes(8)));

        Log::info('[sms-engine] [log] message dispatched', [
            'sid' => $sid,
            'to' => LogRedactor::maskPhone($to),
            'body' => LogRedactor::maskCodes($body),
        ]);

        return $sid;
    }

    private function stored(string $field): ?string
    {
        $raw = AdminSetting::get('sms_engine_' . $field);

        if ($raw === null || $raw === '') {
            return null;
        }

        if (in_array($field, self::SECRET_FIELDS, true)) {
            try {
                return Crypt::decryptString((string) $raw);
            } catch (Exception $e) {
                Log::warning("Failed to decrypt sms engine field {$field}", ['error' => $e->getMessage()]);

                return null;
            }
        }

        return (string) $raw;
    }

    private function hasStored(string $field): bool
    {
        return $this->stored($field) !== null;
    }
}