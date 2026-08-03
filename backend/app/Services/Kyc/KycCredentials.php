<?php

namespace App\Services\Kyc;

use App\Models\AdminSetting;
use Illuminate\Support\Facades\Crypt;

/**
 * Resolves provider credentials from admin_settings (encrypted) with a
 * config/env fallback, so API keys can be set from the admin UI without
 * touching .env. Secret values are encrypted at rest via Laravel's Crypt.
 */
class KycCredentials
{
    /**
     * AdminSetting key used for a provider credential, e.g. "kyc_didit_api_key".
     */
    public static function settingKey(string $provider, string $key): string
    {
        return "kyc_{$provider}_{$key}";
    }

    /**
     * Resolve a credential value: admin override first, then config/env.
     */
    public static function resolve(string $provider, string $configKey, mixed $default = null): mixed
    {
        $settingKey = self::settingKey($provider, $configKey);

        if (AdminSetting::where('key', $settingKey)->exists()) {
            $raw = (string) AdminSetting::get($settingKey, '');

            if ($raw === '') {
                return $default;
            }

            try {
                return Crypt::decryptString($raw);
            } catch (\Throwable $e) {
                // Value may be stored plaintext (pre-encryption) — fall through.
                return $raw;
            }
        }

        return $default;
    }

    /**
     * Persist a credential from the admin UI, encrypted at rest.
     */
    public static function set(string $provider, string $configKey, string $value): void
    {
        AdminSetting::set(self::settingKey($provider, $configKey), Crypt::encryptString($value));
    }

    /**
     * Whether a credential is set (either via admin settings or config/env).
     */
    public static function isSet(string $provider, string $configKey, mixed $configValue = ''): bool
    {
        if (self::resolve($provider, $configKey, '') !== '') {
            return true;
        }

        return (string) $configValue !== '';
    }

    /**
     * Remove an admin-set credential override (falls back to config/env).
     */
    public static function clear(string $provider, string $configKey): void
    {
        AdminSetting::where('key', self::settingKey($provider, $configKey))->delete();
    }
}
