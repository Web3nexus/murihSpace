<?php

namespace App\Services;

use App\Models\AdminSetting;
use Exception;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

/**
 * OAuth token exchange + profile fetch for Google and Apple.
 *
 * Facebook login has been permanently removed from the platform. Client id /
 * secret / redirect are stored in admin_settings (secrets encrypted), with
 * env() fallbacks from config/services.php.
 */
class OAuthProviderService
{
    public const PROVIDERS = ['google', 'apple'];

    private const STATE_TTL_MINUTES = 15;

    private Client $http;

    public function __construct()
    {
        $this->http = new Client([
            'timeout' => 15,
            'connect_timeout' => 10,
            'http_errors' => false,
        ]);
    }

    /* ─────────────────────────── config ─────────────────────────── */

    public function providers(): array
    {
        return self::PROVIDERS;
    }

    /**
     * Resolve config for a provider: stored admin_settings override env().
     */
    public function config(string $provider): array
    {
        $stored = fn (string $field) => $this->stored($provider, $field);

        return [
            'client_id' => $stored('client_id') ?: (string) config("services.{$provider}.client_id", ''),
            'client_secret' => $stored('client_secret') ?: (string) config("services.{$provider}.client_secret", ''),
            'redirect' => $stored('redirect') ?: (string) config("services.{$provider}.redirect", ''),
            'team_id' => $stored('team_id') ?: (string) config("services.{$provider}.team_id", ''),
            'key_id' => $stored('key_id') ?: (string) config("services.{$provider}.key_id", ''),
            'private_key' => $stored('private_key') ?: (string) config("services.{$provider}.private_key", ''),
        ];
    }

    public function isConfigured(string $provider): bool
    {
        if (! in_array($provider, self::PROVIDERS, true)) {
            return false;
        }

        $config = $this->config($provider);

        if (! $config['client_id'] || ! $config['redirect']) {
            return false;
        }

        if ($provider === 'apple') {
            return $config['team_id'] !== '' && $config['key_id'] !== '' && $config['private_key'] !== '';
        }

        return $config['client_secret'] !== '';
    }

    /**
     * Masked metadata for the admin UI. Never exposes secrets.
     */
    public function metadata(): array
    {
        $meta = [];

        foreach (self::PROVIDERS as $provider) {
            $config = $this->config($provider);
            $meta[$provider] = [
                'configured' => $this->isConfigured($provider),
                'client_id' => $config['client_id'],
                'client_id_from_env' => (bool) config("services.{$provider}.client_id"),
                'secret_from_env' => (bool) config("services.{$provider}.client_secret"),
                'redirect' => $config['redirect'],
            ];
        }

        return $meta;
    }

    public function configure(string $provider, array $data): void
    {
        if (! in_array($provider, self::PROVIDERS, true)) {
            return;
        }

        $map = [
            'client_id' => 'client_id',
            'client_secret' => 'client_secret',
            'redirect' => 'redirect',
            'team_id' => 'team_id',
            'key_id' => 'key_id',
            'private_key' => 'private_key',
        ];

        foreach ($map as $field => $key) {
            if (! array_key_exists($field, $data)) {
                continue;
            }

            $value = $data[$field];
            if ($value === null || trim((string) $value) === '') {
                AdminSetting::set("oauth_{$provider}_{$key}", '');
                continue;
            }

            if (in_array($key, ['client_secret', 'private_key'], true)) {
                AdminSetting::set("oauth_{$provider}_{$key}", Crypt::encryptString(trim((string) $value)));
            } else {
                AdminSetting::set("oauth_{$provider}_{$key}", trim((string) $value));
            }
        }
    }

    private function stored(string $provider, string $field): ?string
    {
        $key = "oauth_{$provider}_{$field}";
        $raw = AdminSetting::get($key);

        if ($raw === null || $raw === '') {
            return null;
        }

        if (in_array($field, ['client_secret', 'private_key'], true)) {
            try {
                return Crypt::decryptString((string) $raw);
            } catch (Exception $e) {
                Log::warning("Failed to decrypt OAuth secret for {$provider}.{$field}", ['error' => $e->getMessage()]);

                return null;
            }
        }

        return (string) $raw;
    }

    /* ─────────────────────── state (CSRF) ─────────────────────── */

    public function state(string $provider): string
    {
        $payload = [
            'p' => $provider,
            't' => now()->addMinutes(self::STATE_TTL_MINUTES)->timestamp,
            'r' => bin2hex(random_bytes(16)),
        ];

        return Crypt::encryptString(json_encode($payload));
    }

    public function verifyState(string $state, string $provider): bool
    {
        try {
            $payload = json_decode(Crypt::decryptString($state), true);
        } catch (Exception $e) {
            return false;
        }

        if (! is_array($payload) || ($payload['p'] ?? null) !== $provider) {
            return false;
        }

        if (! isset($payload['t']) || (int) $payload['t'] < now()->timestamp) {
            return false;
        }

        return true;
    }

    /* ─────────────────────── authorize URL ─────────────────────── */

    public function authorizeUrl(string $provider, string $state): string
    {
        $config = $this->config($provider);

        $params = http_build_query([
            'client_id' => $config['client_id'],
            'redirect_uri' => $config['redirect'],
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'prompt' => 'select_account',
        ]);

        return match ($provider) {
            'google' => 'https://accounts.google.com/o/oauth2/v2/auth?'.$params,
            'apple' => 'https://appleid.apple.com/auth/authorize?'.http_build_query([
                'client_id' => $config['client_id'],
                'redirect_uri' => $config['redirect'],
                'response_type' => 'code',
                'scope' => 'name email',
                'state' => $state,
                'response_mode' => 'form_post',
            ]),
            default => throw new Exception("Unsupported provider: {$provider}"),
        };
    }

    /* ─────────────────────── token exchange ─────────────────────── */

    /**
     * Exchange the authorization code for provider profile info.
     *
     * @return array{id: string, email: string, name: ?string, avatar: ?string, email_verified: bool}|null
     */
    public function profile(string $provider, string $code, array $formPost = []): ?array
    {
        if (! in_array($provider, self::PROVIDERS, true)) {
            return null;
        }

        return match ($provider) {
            'google' => $this->googleProfile($code),
            'apple' => $this->appleProfile($code, $formPost),
            default => null,
        };
    }

    private function googleProfile(string $code): ?array
    {
        $config = $this->config('google');

        $tokenRes = $this->http->post('https://oauth2.googleapis.com/token', [
            'form_params' => [
                'code' => $code,
                'client_id' => $config['client_id'],
                'client_secret' => $config['client_secret'],
                'redirect_uri' => $config['redirect'],
                'grant_type' => 'authorization_code',
            ],
        ]);

        $token = json_decode((string) $tokenRes->getBody(), true);
        $accessToken = $token['access_token'] ?? null;

        if ($tokenRes->getStatusCode() !== 200 || ! $accessToken) {
            Log::warning('Google OAuth token exchange failed', ['status' => $tokenRes->getStatusCode(), 'body' => $token]);

            return null;
        }

        $userRes = $this->http->get('https://openidconnect.googleapis.com/v1/userinfo', [
            'headers' => ['Authorization' => 'Bearer '.$accessToken],
        ]);

        $user = json_decode((string) $userRes->getBody(), true);

        if ($userRes->getStatusCode() !== 200 || empty($user['email'])) {
            Log::warning('Google OAuth userinfo failed', ['status' => $userRes->getStatusCode(), 'body' => $user]);

            return null;
        }

        return $this->normalize('google', $user);
    }

    private function appleProfile(string $code, array $formPost = []): ?array
    {
        $config = $this->config('apple');

        $tokenRes = $this->http->post('https://appleid.apple.com/auth/token', [
            'form_params' => [
                'code' => $code,
                'client_id' => $config['client_id'],
                'client_secret' => $this->appleClientSecret($config),
                'grant_type' => 'authorization_code',
            ],
        ]);

        $token = json_decode((string) $tokenRes->getBody(), true);

        if ($tokenRes->getStatusCode() !== 200 || empty($token['id_token'])) {
            Log::warning('Apple OAuth token exchange failed', ['status' => $tokenRes->getStatusCode(), 'body' => $token]);

            return null;
        }

        // The user profile (name) is only delivered in the form_post body on first sign-in.
        $segments = explode('.', (string) $token['id_token']);
        $claims = isset($segments[1]) ? json_decode($this->base64UrlDecode($segments[1]), true) : [];

        if (($claims['aud'] ?? null) !== $config['client_id']) {
            Log::warning('Apple id_token aud mismatch', ['aud' => $claims['aud'] ?? null]);

            return null;
        }

        $name = null;
        if (isset($formPost['user'])) {
            $userJson = json_decode((string) $formPost['user'], true);
            $name = trim(($userJson['name']['firstName'] ?? '').' '.($userJson['name']['lastName'] ?? ''));
            $name = $name !== '' ? $name : null;
        }

        $email = $claims['email'] ?? null;
        $id = $claims['sub'] ?? null;

        if (! $id || ! $email) {
            Log::warning('Apple id_token missing claims', ['claims' => $claims]);

            return null;
        }

        return [
            'id' => (string) $id,
            'email' => (string) $email,
            'name' => $name,
            'avatar' => null,
            'email_verified' => (bool) ($claims['email_verified'] ?? false),
        ];
    }

    /**
     * Apple Sign In requires a signed JWT as the client_secret.
     */
    private function appleClientSecret(array $config): string
    {
        $header = $this->base64UrlEncode(json_encode(['alg' => 'ES256', 'kid' => $config['key_id']]));

        $claims = [
            'iss' => $config['team_id'],
            'iat' => now()->timestamp,
            'exp' => now()->addMonths(5)->timestamp,
            'aud' => 'https://appleid.apple.com',
            'sub' => $config['client_id'],
        ];

        $payload = $this->base64UrlEncode(json_encode($claims));

        $key = openssl_pkey_get_private((string) $config['private_key']);
        if ($key === false) {
            throw new Exception('Invalid Apple private key.');
        }

        $signature = '';
        openssl_sign($header.'.'.$payload, $signature, $key, OPENSSL_ALGO_SHA256);

        return $header.'.'.$payload.'.'.$this->base64UrlEncode($signature);
    }

    private function normalize(string $provider, array $user): array
    {
        return match ($provider) {
            'google' => [
                'id' => (string) ($user['sub'] ?? $user['id'] ?? ''),
                'email' => (string) ($user['email'] ?? ''),
                'name' => $user['name'] ?? null,
                'avatar' => $user['picture'] ?? null,
                'email_verified' => (bool) ($user['email_verified'] ?? false),
            ],
            default => [],
        };
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'), true) ?: '';
    }
}
