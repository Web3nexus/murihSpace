<?php

namespace App\Services;

use App\Models\AdminSetting;
use Exception;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

class MailEngineService
{
    private const PASSWORD_FIELDS = ['password', 'postmark_key', 'resend_key'];

    public function transports(): array
    {
        return ['smtp', 'log', 'postmark', 'ses', 'resend', 'sendmail', 'array'];
    }

    public function selected(): string
    {
        $selected = (string) AdminSetting::get('mail_engine', config('mail.default', 'log'));

        return in_array($selected, $this->transports(), true) ? $selected : 'log';
    }

    public function setSelected(string $transport): void
    {
        if (! in_array($transport, $this->transports(), true)) {
            return;
        }

        AdminSetting::set('mail_engine', $transport);
    }

    /**
     * Effective settings for the admin UI. Never exposes secrets.
     */
    public function metadata(): array
    {
        $data = [
            'transport' => $this->selected(),
            'default_transport' => config('mail.default', 'log'),
            'from_address' => $this->stored('from_address') ?? config('mail.from.address'),
            'from_name' => $this->stored('from_name') ?? config('mail.from.name'),
            'smtp' => [
                'host' => $this->stored('smtp_host') ?? config('mail.mailers.smtp.host'),
                'port' => $this->stored('smtp_port') ?? config('mail.mailers.smtp.port'),
                'scheme' => $this->stored('smtp_scheme') ?? config('mail.mailers.smtp.scheme'),
                'encryption' => $this->stored('smtp_encryption') ?? null,
                'username' => $this->stored('smtp_username') ?? config('mail.mailers.smtp.username'),
                'has_password' => $this->hasStored('smtp_password') || (bool) config('mail.mailers.smtp.password'),
            ],
            'postmark' => [
                'has_key' => $this->hasStored('postmark_key') || (bool) config('services.postmark.key'),
            ],
            'resend' => [
                'has_key' => $this->hasStored('resend_key') || (bool) config('services.resend.key'),
            ],
            'sendmail' => [
                'path' => $this->stored('sendmail_path') ?? config('mail.mailers.sendmail.path'),
            ],
        ];

        return $data;
    }

    public function update(array $data): void
    {
        if (isset($data['transport'])) {
            $this->setSelected($data['transport']);
        }

        $stringFields = [
            'from_address', 'from_name',
            'smtp_host', 'smtp_port', 'smtp_scheme', 'smtp_encryption', 'smtp_username',
            'sendmail_path',
        ];

        foreach ($stringFields as $field) {
            if (array_key_exists($field, $data)) {
                AdminSetting::set('mail_engine_' . $field, trim((string) $data[$field]));
            }
        }

        foreach (['smtp_password', 'postmark_key', 'resend_key'] as $secret) {
            if (isset($data[$secret]) && trim((string) $data[$secret]) !== '') {
                AdminSetting::set('mail_engine_' . $secret, Crypt::encryptString(trim((string) $data[$secret])));
            }
        }
    }

    /**
     * Push stored settings into the runtime config so Laravel's mailer uses them.
     */
    public function apply(): void
    {
        $transport = $this->selected();

        config(['mail.default' => $transport]);

        if (($host = $this->stored('smtp_host')) !== null) {
            config(['mail.mailers.smtp.host' => $host]);
        }
        if (($port = $this->stored('smtp_port')) !== null) {
            config(['mail.mailers.smtp.port' => (int) $port]);
        }
        if (($scheme = $this->stored('smtp_scheme')) !== null) {
            config(['mail.mailers.smtp.scheme' => $scheme]);
        }
        if (($encryption = $this->stored('smtp_encryption')) !== null) {
            config(['mail.mailers.smtp.encryption' => $encryption]);
        }
        if (($username = $this->stored('smtp_username')) !== null) {
            config(['mail.mailers.smtp.username' => $username]);
        }
        if (($password = $this->stored('smtp_password')) !== null) {
            config(['mail.mailers.smtp.password' => $password]);
        }
        if (($path = $this->stored('sendmail_path')) !== null) {
            config(['mail.mailers.sendmail.path' => $path]);
        }

        if (($postmark = $this->stored('postmark_key')) !== null) {
            config(['services.postmark.key' => $postmark]);
        }
        if (($resend = $this->stored('resend_key')) !== null) {
            config(['services.resend.key' => $resend]);
        }

        if (($from = $this->stored('from_address')) !== null) {
            config(['mail.from.address' => $from]);
        }
        if (($fromName = $this->stored('from_name')) !== null) {
            config(['mail.from.name' => $fromName]);
        }
    }

    private function stored(string $field): ?string
    {
        $raw = AdminSetting::get('mail_engine_' . $field);

        if ($raw === null || $raw === '') {
            return null;
        }

        if (in_array($field, self::PASSWORD_FIELDS, true)) {
            try {
                return Crypt::decryptString((string) $raw);
            } catch (Exception $e) {
                Log::warning("Failed to decrypt mail engine field {$field}", ['error' => $e->getMessage()]);

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
