<?php

namespace App\Services;

use App\Models\AdminSetting;
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
    private const TWILIO_BASE_URL = 'https://api.twilio.com/2010-04-01/Accounts';

    private const SECRET_FIELDS = ['auth_token'];

    private Client $http;

    public function __construct()
    {
        $this->http = new Client([
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
        $selected = (string) AdminSetting::get('sms_engine', config('services.sms.driver', 'log'));

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
                'account_sid' => $this->stored('account_sid') ?? config('services.sms.account_sid'),
                'from_number' => $this->stored('from_number') ?? config('services.sms.from_number'),
                'has_auth_token' => $this->hasStored('auth_token') || (bool) config('services.sms.auth_token'),
            ],
        ];
    }

    public function update(array $data): void
    {
        if (isset($data['transport'])) {
            $this->setSelected($data['transport']);
        }

        foreach (['account_sid', 'from_number'] as $field) {
            if (array_key_exists($field, $data)) {
                AdminSetting::set('sms_engine_' . $field, trim((string) $data[$field]));
            }
        }

        if (isset($data['auth_token']) && trim((string) $data['auth_token']) !== '') {
            AdminSetting::set('sms_engine_auth_token', Crypt::encryptString(trim((string) $data['auth_token'])));
        }
    }

    /**
     * Push stored settings into the runtime config so send() picks them up.
     */
    public function apply(): void
    {
        config(['services.sms.driver' => $this->selected()]);

        if (($sid = $this->stored('account_sid')) !== null) {
            config(['services.sms.account_sid' => $sid]);
        }
        if (($token = $this->stored('auth_token')) !== null) {
            config(['services.sms.auth_token' => $token]);
        }
        if (($from = $this->stored('from_number')) !== null) {
            config(['services.sms.from_number' => $from]);
        }
    }

    /**
     * Send a single SMS through the selected transport. Returns the provider
     * message SID when known. Throws on hard configuration failures so callers
     * can report meaningful errors.
     *
     * @throws \RuntimeException
     */
    public function send(string $to, string $body): ?string
    {
        if (trim($to) === '' || trim($body) === '') {
            throw new \InvalidArgumentException('Recipient and message body are required.');
        }

        return match ($this->selected()) {
            'twilio' => $this->sendViaTwilio($to, $body),
            default => $this->sendViaLog($to, $body),
        };
    }

    private function sendViaTwilio(string $to, string $body): string
    {
        $accountSid = (string) config('services.sms.account_sid');
        $authToken = (string) config('services.sms.auth_token');
        $from = (string) config('services.sms.from_number');

        if ($accountSid === '' || $authToken === '' || $from === '') {
            throw new \RuntimeException('Twilio SMS is not configured. Set an Account SID, Auth Token and From number.');
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
            'to' => $to,
            'body' => $body,
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