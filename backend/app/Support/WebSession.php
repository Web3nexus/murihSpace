<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Cookie sessions for the first-party web app.
 *
 * Mobile keeps its bearer token. A request is treated as web when Sanctum's
 * stateful check matches its Origin/Referer against sanctum.stateful. For web
 * requests the token is still minted server-side, but it is bound to the
 * Laravel session and never returned in a response body. The httpOnly session
 * cookie is the only credential the browser holds.
 *
 * The bound token row is what keeps every existing token feature working for
 * web: the device list, revoke-one and revoke-others, the admin:mfa check and
 * the impersonation liveness check all read currentAccessToken(), which the
 * User model resolves to this row for a session-authenticated request.
 */
final class WebSession
{
    /** Session key holding the id of the personal access token this session is bound to. */
    public const TOKEN_KEY = 'web_session_token_id';

    public static function isWebRequest(Request $request): bool
    {
        return EnsureFrontendRequestsAreStateful::fromFrontend($request);
    }

    /**
     * Session cookie middleware for routes outside the stateful API stack.
     * The OAuth callback is a browser navigation from the provider, so it has
     * no frontend Origin and needs the session stack added explicitly.
     *
     * @return list<class-string>
     */
    public static function cookieMiddleware(): array
    {
        return [
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
        ];
    }

    /** Log the user into the session guard and bind the session to the token. */
    public static function bind(Request $request, PersonalAccessToken $token, User $user): void
    {
        $request->session()->regenerate();
        $request->session()->put(self::TOKEN_KEY, $token->getKey());
        Auth::guard('web')->login($user);
    }

    /** The token id this session is bound to, or null when the session has none. */
    public static function boundTokenId(Request $request): ?int
    {
        if (! $request->hasSession()) {
            return null;
        }

        $id = $request->session()->get(self::TOKEN_KEY);

        return $id === null ? null : (int) $id;
    }

    /**
     * Whether the session's user still owns the token it is bound to. A
     * revoked, expired or re-assigned token ends the session.
     */
    public static function isLive(Request $request, User $user): bool
    {
        // An impersonated session has no bound token. It is live while it is
        // acting as the target it was started for; EnsureImpersonationLiveness
        // ends it when the clocks run out or the administrator loses rights.
        if (ImpersonationSession::active($request)) {
            return ImpersonationSession::targetId($request) === (int) $user->getKey();
        }

        $tokenId = self::boundTokenId($request);

        if ($tokenId === null) {
            return false;
        }

        return PersonalAccessToken::query()
            ->whereKey($tokenId)
            ->where('tokenable_type', $user->getMorphClass())
            ->where('tokenable_id', $user->getKey())
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->exists();
    }

    /** Log out of the session guard and invalidate the session and its cookie id. */
    public static function end(Request $request): void
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
    }
}
