<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Admin-controlled authentication methods.
 *
 * Config is stored as JSON in the admin_settings table (key: auth_methods) and
 * drives which login/registration methods are shown and accepted. The public
 * surface (->public()) never includes secrets.
 */
class AuthMethodConfigService
{
    public const SETTING_KEY = 'auth_methods';

    public const METHODS = ['phone_otp', 'email_password', 'google', 'apple', 'passkey'];

    public const DEFAULTS = [
        'primary' => 'phone_otp',
        'methods' => [
            'phone_otp' => ['registration' => true, 'login' => true, 'display_order' => 1],
            'email_password' => ['registration' => true, 'login' => true, 'display_order' => 2],
            'google' => ['registration' => false, 'login' => false, 'display_order' => 3],
            'apple' => ['registration' => false, 'login' => false, 'display_order' => 4],
            'passkey' => ['registration' => false, 'login' => false, 'display_order' => 5],
        ],
    ];

    /**
     * Full config used by admins (includes display_order and primary).
     */
    public function all(): array
    {
        $raw = AdminSetting::get(self::SETTING_KEY);
        $stored = $raw !== null && $raw !== '' ? json_decode((string) $raw, true) : null;

        return is_array($stored) ? $this->normalize($stored) : self::DEFAULTS;
    }

    /**
     * Public config for login/registration screens. Never exposes secrets.
     */
    public function public(): array
    {
        $all = $this->all();
        $methods = [];

        foreach ($all['methods'] as $key => $cfg) {
            $methods[$key] = [
                'login' => (bool) ($cfg['login'] ?? false),
                'registration' => (bool) ($cfg['registration'] ?? false),
            ];
        }

        return [
            'primary' => $all['primary'],
            'methods' => $methods,
        ];
    }

    public function loginEnabled(string $method): bool
    {
        return (bool) ($this->all()['methods'][$method]['login'] ?? false);
    }

    public function registrationEnabled(string $method): bool
    {
        return (bool) ($this->all()['methods'][$method]['registration'] ?? false);
    }

    /**
     * Persist a new configuration with safety guards, writing an audit record.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(array $data, User $actor): array
    {
        $config = $this->merge($data);
        $this->assertSafe($config);

        AdminSetting::set(self::SETTING_KEY, json_encode($config));

        AuditLog::create([
            'user_id' => $actor->id,
            'action' => 'auth.methods.updated',
            'resource_type' => 'auth_methods',
            'resource_id' => null,
            'metadata' => [
                'config' => $config,
                'changed_by' => $actor->username ?: $actor->email,
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return $config;
    }

    private function merge(array $data): array
    {
        $defaults = self::DEFAULTS;
        $methods = $defaults['methods'];

        foreach (self::METHODS as $method) {
            if (! isset($data['methods'][$method]) || ! is_array($data['methods'][$method])) {
                continue;
            }
            $methods[$method] = array_merge($defaults['methods'][$method], array_filter($data['methods'][$method], fn ($v) => $v !== null));
        }

        return [
            'primary' => in_array($data['primary'] ?? null, self::METHODS, true) ? $data['primary'] : $defaults['primary'],
            'methods' => $methods,
        ];
    }

    private function normalize(array $stored): array
    {
        $defaults = self::DEFAULTS;
        $methods = [];

        foreach (self::METHODS as $method) {
            $cfg = $stored['methods'][$method] ?? [];
            $methods[$method] = array_merge($defaults['methods'][$method], is_array($cfg) ? $cfg : []);
        }

        return [
            'primary' => in_array($stored['primary'] ?? null, self::METHODS, true) ? $stored['primary'] : $defaults['primary'],
            'methods' => $methods,
        ];
    }

    private function assertSafe(array $config): void
    {
        $loginOn = array_filter($config['methods'], fn (array $m) => (bool) ($m['login'] ?? false));

        if (count($loginOn) === 0) {
            throw ValidationException::withMessages([
                'methods' => ['At least one login method must remain enabled.'],
            ]);
        }

        // The two self-service core methods must not both be disabled, otherwise
        // a misconfiguration could lock every user (including admins) out.
        $coreLoginOn = (bool) ($config['methods']['phone_otp']['login'] ?? false)
            || (bool) ($config['methods']['email_password']['login'] ?? false);

        if (! $coreLoginOn) {
            throw ValidationException::withMessages([
                'methods' => ['Phone OTP or Email & password login must remain enabled.'],
            ]);
        }
    }
}
