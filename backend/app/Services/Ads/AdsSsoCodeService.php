<?php

namespace App\Services\Ads;

use App\Models\User;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Short-lived, single-use codes that carry a MurihSpace user into Ads Manager.
 *
 * The code is random and stored only as a hash. It is bound to the redirect URI
 * the server picked from config, so a code minted for one audience cannot be
 * exchanged for another. The exchange removes the code before comparing
 * anything, so a second use, or a mismatched one, finds nothing.
 */
class AdsSsoCodeService
{
    public const TTL_SECONDS = 120;

    private const PREFIX = 'ads-sso:code:';

    /** The one URI a code may be sent back to. Configured, never taken from the request. */
    public function configuredRedirectUri(): ?string
    {
        $uri = config('services.ads_sso.redirect_uri');

        if (! is_string($uri) || $uri === '' || filter_var($uri, FILTER_VALIDATE_URL) === false) {
            return null;
        }

        return $uri;
    }

    public function issue(User $user, string $redirectUri): string
    {
        $code = Str::random(64);

        Cache::put(self::key($code), [
            'user_id' => $user->getKey(),
            'redirect_uri' => $redirectUri,
        ], self::TTL_SECONDS);

        return $code;
    }

    /**
     * @return array{status: 'ok', user: User}|array{status: 'invalid'|'redirect_mismatch'|'ineligible'}
     */
    public function consume(string $code, string $redirectUri): array
    {
        $key = self::key($code);

        try {
            return Cache::lock($key.':lock', 5)->block(3, function () use ($key, $redirectUri) {
                $payload = Cache::pull($key);

                if (! is_array($payload) || ! isset($payload['user_id'], $payload['redirect_uri'])) {
                    return ['status' => 'invalid'];
                }

                if (! hash_equals((string) $payload['redirect_uri'], $redirectUri)) {
                    return ['status' => 'redirect_mismatch'];
                }

                $user = User::find($payload['user_id']);

                if (! $user) {
                    return ['status' => 'invalid'];
                }

                if (! AdsSyncService::isEligibleForAds($user->role)) {
                    return ['status' => 'ineligible'];
                }

                return ['status' => 'ok', 'user' => $user];
            });
        } catch (LockTimeoutException) {
            return ['status' => 'invalid'];
        }
    }

    private static function key(string $code): string
    {
        return self::PREFIX.hash('sha256', $code);
    }
}
