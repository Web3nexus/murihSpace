<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Impersonation for the web app, held in the administrator's own session.
 *
 * Starting impersonation does not mint a bearer token. The session guard's
 * user is switched to the target, and the session records who the real
 * administrator was. Stopping restores the administrator from that record.
 * The browser keeps the same httpOnly cookie throughout.
 *
 * Session keys (all set only by start(), all cleared by stop() or end()):
 *  - impersonator_id              the administrator who started it
 *  - impersonator_token_id        the administrator's admin-token row, to restore the session binding
 *  - impersonation_target_id      the user the session is acting as
 *  - impersonation_started_at     absolute clock, capped at MAX_SECONDS
 *  - impersonation_last_activity_at  idle clock, capped at IDLE_SECONDS
 *
 * EnsureImpersonationLiveness enforces the clocks and re-checks the
 * administrator on every request.
 */
final class ImpersonationSession
{
    public const IMPERSONATOR_KEY = 'impersonator_id';

    public const IMPERSONATOR_TOKEN_KEY = 'impersonator_token_id';

    public const TARGET_KEY = 'impersonation_target_id';

    public const STARTED_KEY = 'impersonation_started_at';

    public const ACTIVITY_KEY = 'impersonation_last_activity_at';

    /** Absolute limit on one impersonation, however active it is. */
    public const MAX_SECONDS = 7200;

    /** Inactivity limit before impersonation ends. */
    public const IDLE_SECONDS = 900;

    public static function active(Request $request): bool
    {
        return $request->hasSession() && $request->session()->has(self::IMPERSONATOR_KEY);
    }

    public static function impersonatorId(Request $request): ?int
    {
        if (! self::active($request)) {
            return null;
        }

        return (int) $request->session()->get(self::IMPERSONATOR_KEY);
    }

    public static function targetId(Request $request): ?int
    {
        if (! self::active($request)) {
            return null;
        }

        return (int) $request->session()->get(self::TARGET_KEY);
    }

    /**
     * Switch the current web session to the target. The caller has already
     * checked permission, MFA and the target's status.
     */
    public static function start(Request $request, User $admin, User $target, int $adminTokenId): void
    {
        $session = $request->session();

        $session->put(self::IMPERSONATOR_KEY, $admin->getKey());
        $session->put(self::IMPERSONATOR_TOKEN_KEY, $adminTokenId);
        $session->put(self::TARGET_KEY, $target->getKey());
        $session->put(self::STARTED_KEY, now()->timestamp);
        $session->put(self::ACTIVITY_KEY, now()->timestamp);

        // The target has no bound token. The admin's binding must not follow them.
        $session->forget(WebSession::TOKEN_KEY);

        // login() regenerates the session id and keeps the data.
        Auth::guard('web')->login($target);
    }

    /**
     * Stop impersonation and return the session to the administrator. If the
     * administrator no longer holds a valid MFA session, the whole session is
     * ended instead and null is returned.
     */
    public static function stop(Request $request): ?User
    {
        $adminId = self::impersonatorId($request);
        $adminTokenId = $request->session()->get(self::IMPERSONATOR_TOKEN_KEY);
        self::clear($request);

        $admin = $adminId ? User::find($adminId) : null;

        if (! $admin || ! self::adminStillAuthorised($admin, $adminTokenId)) {
            WebSession::end($request);

            return null;
        }

        $request->session()->put(WebSession::TOKEN_KEY, (int) $adminTokenId);
        Auth::guard('web')->login($admin);

        return $admin;
    }

    /** End the session completely. Used when the administrator can no longer be trusted. */
    public static function abandon(Request $request): void
    {
        self::clear($request);
        WebSession::end($request);
    }

    /**
     * Whether the administrator who started an impersonation still holds the
     * rights to it: an active admin with an admin_role, and an unexpired
     * admin-token row carrying the MFA ability.
     */
    public static function adminStillAuthorised(User $admin, mixed $adminTokenId): bool
    {
        if ($admin->status !== 'active' || $admin->role !== 'admin' || empty($admin->admin_role)) {
            return false;
        }

        if ($adminTokenId === null) {
            return false;
        }

        $token = PersonalAccessToken::find((int) $adminTokenId);

        if (! $token
            || (int) $token->tokenable_id !== (int) $admin->getKey()
            || $token->tokenable_type !== $admin->getMorphClass()
            || $token->name !== AdminSession::TOKEN_NAME
            || ($token->expires_at && $token->expires_at->isPast())) {
            return false;
        }

        $abilities = $token->abilities ?? [];

        return is_array($abilities) && in_array(AdminSession::ABILITY_MFA, $abilities, true);
    }

    /** The session's admin token id, as stored when impersonation started. */
    public static function adminTokenId(Request $request): mixed
    {
        return $request->session()->get(self::IMPERSONATOR_TOKEN_KEY);
    }

    public static function audit(?int $adminId, string $action, int $targetId, Request $request, array $metadata = []): void
    {
        try {
            AuditLog::create([
                'user_id'       => $adminId,
                'action'        => $action,
                'resource_type' => 'user',
                'resource_id'   => (string) $targetId,
                'metadata'      => $metadata ?: null,
                'ip_address'    => $request->ip(),
                'user_agent'    => $request->userAgent(),
            ]);
        } catch (\Throwable) {
        }
    }

    private static function clear(Request $request): void
    {
        $request->session()->forget([
            self::IMPERSONATOR_KEY,
            self::IMPERSONATOR_TOKEN_KEY,
            self::TARGET_KEY,
            self::STARTED_KEY,
            self::ACTIVITY_KEY,
        ]);
    }
}
