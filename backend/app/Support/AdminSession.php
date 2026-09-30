<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * The contract for an administration session.
 *
 * An administration session is not "a consumer session belonging to somebody
 * whose role happens to be admin". It is a distinct credential class, and the
 * three properties below are what make it one:
 *
 *  - it is only ever issued by AdminAuthController, after a second factor has
 *    been cleared;
 *  - it is tagged with a Sanctum ability (ABILITY_MFA) that IsAdmin insists on,
 *    so a session issued by the shared /auth/login cannot reach the
 *    administration surface even though that same account can still sign in
 *    there — which it must be able to do, in order to enrol a second factor;
 *  - it expires on a short clock, independently of the consumer expiry.
 *
 * Keeping the constants and the challenge mechanics here means the controller
 * that issues, the middleware that admits, and the tests that assert cannot
 * drift apart.
 */
final class AdminSession
{
    /** Sanctum ability marking a session as having cleared a second factor. */
    public const ABILITY_MFA = 'admin:mfa';

    /** Sanctum token name. Kept distinct from 'auth-token' so the two can be revoked independently. */
    public const TOKEN_NAME = 'admin-token';

    /** How long a half-completed login (password accepted, factor not yet) stays usable. */
    public const CHALLENGE_TTL_SECONDS = 300;

    /** Second-factor guesses allowed against one challenge before it is destroyed. */
    public const CHALLENGE_MAX_ATTEMPTS = 5;

    private const CHALLENGE_PREFIX = 'admin-login-challenge:';

    /**
     * Whether the current request carries a session that cleared a second factor.
     *
     * The discriminator is the token name, not a Sanctum ability. Every login
     * path issues its token with the wildcard '*' ability, and
     * PersonalAccessToken::can() returns true for '*', so an ability check
     * would admit any ordinary session. TransientToken::can() returns true
     * unconditionally, which is worse still. EnsureImpersonationLiveness hit this
     * exact trap and left the reasoning on record; this is the same fix applied
     * to the administration surface.
     *
     * The name is trustworthy because only AdminAuthController creates tokens
     * named 'admin-token', and it does so only after a second factor has been
     * verified. The non-wildcard ability is kept as a secondary signal.
     *
     * A stateful (cookie) session returns false: the administration surface is
     * not reached that way, so an absent bearer token is a refusal rather than
     * a pass.
     */
    public static function clearedMfa(Request $request): bool
    {
        $token = $request->user()?->currentAccessToken();

        if (! $token instanceof PersonalAccessToken) {
            return false;
        }

        if ($token->name !== self::TOKEN_NAME) {
            return false;
        }

        $abilities = $token->abilities ?? [];

        return is_array($abilities) && in_array(self::ABILITY_MFA, $abilities, true);
    }

    /**
     * Begin a half-completed administration login.
     *
     * The challenge carries no authority: it identifies the account that has
     * already proved a password, for long enough to accept a second factor. It
     * is bound to the submitting IP so it cannot be harvested from one address
     * and completed from another, and it is destroyed on first successful use.
     */
    public static function issueChallenge(User $user, Request $request): string
    {
        $challenge = Str::random(80);

        Cache::put(self::CHALLENGE_PREFIX.$challenge, [
            'user_id' => $user->id,
            'ip' => $request->ip(),
            'attempts' => 0,
        ], self::CHALLENGE_TTL_SECONDS);

        return $challenge;
    }

    /**
     * Resolve a challenge to its account without consuming it.
     *
     * Returns null for an unknown, expired or already-spent challenge. The IP
     * binding is checked here rather than on success so a challenge presented
     * from the wrong address cannot be ground down by repeated guesses.
     */
    public static function resolveChallenge(string $challenge, Request $request): ?User
    {
        $key = self::CHALLENGE_PREFIX.$challenge;
        $payload = Cache::get($key);

        if (! is_array($payload)) {
            return null;
        }

        if (($payload['ip'] ?? null) !== $request->ip()) {
            Cache::forget($key);

            return null;
        }

        if (($payload['attempts'] ?? 0) >= self::CHALLENGE_MAX_ATTEMPTS) {
            Cache::forget($key);

            return null;
        }

        return User::find($payload['user_id'] ?? 0);
    }

    /** Record a failed guess and destroy the challenge if it has run out of attempts. */
    public static function recordFailedChallengeAttempt(string $challenge): void
    {
        $key = self::CHALLENGE_PREFIX.$challenge;
        $payload = Cache::get($key);

        if (! is_array($payload)) {
            return;
        }

        $payload['attempts'] = ($payload['attempts'] ?? 0) + 1;

        if ($payload['attempts'] >= self::CHALLENGE_MAX_ATTEMPTS) {
            Cache::forget($key);

            return;
        }

        Cache::put($key, $payload, self::CHALLENGE_TTL_SECONDS);
    }

    /** Spend the challenge. A challenge is single-use whether or not the code was correct. */
    public static function consumeChallenge(string $challenge): void
    {
        Cache::forget(self::CHALLENGE_PREFIX.$challenge);
    }
}
