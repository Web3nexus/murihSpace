<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use App\Models\User;
use App\Support\ImpersonationSession;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class EnsureImpersonationLiveness
{
    /**
     * Default idle timeout for impersonation: 15 minutes.
     */
    public const DEFAULT_IDLE_TIMEOUT_SECONDS = 900; // 15 minutes

    public const IMPERSONATION_TOKEN_NAME = 'impersonation-token';

    /**
     * Determine whether the given token is an impersonation token.
     *
     * NOTE: never use $token->can('impersonate') for this. Every regular login
     * token is issued with the wildcard '*' ability (see AuthController,
     * AuthSessionService, SocialAuthController, DeviceSecurityService), and
     * Sanctum's PersonalAccessToken::can() returns true for '*'. That made this
     * middleware treat ordinary sessions as impersonations, delete the valid
     * token and 401 every subsequent request for every user.
     *
     * The token name is the only reliable discriminator, with an explicit
     * non-wildcard 'impersonate' ability as a secondary signal.
     */
    public static function isImpersonationToken(?PersonalAccessToken $token): bool
    {
        if (! $token) {
            return false;
        }

        if ($token->name === self::IMPERSONATION_TOKEN_NAME) {
            return true;
        }

        $abilities = $token->abilities ?? [];

        return is_array($abilities) && in_array('impersonate', $abilities, true);
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (ImpersonationSession::active($request)) {
            return $this->enforceSession($request, $next);
        }

        $user = $request->user();
        if (! $user) {
            return $next($request);
        }

        // Legacy bearer impersonation tokens, issued before web impersonation
        // moved to the session. They expire within two hours and stay enforced
        // until then. No new ones are issued.
        $token = $user->currentAccessToken();
        if (! $token instanceof PersonalAccessToken) {
            return $next($request);
        }

        // Only enforce on impersonation tokens
        if (! self::isImpersonationToken($token)) {
            return $next($request);
        }

        $sessionKey = "impersonation_session_{$token->id}";
        $session = Cache::get($sessionKey);

        if (! is_array($session)) {
            // Session not found in cache or expired
            $token->delete();
            return response()->json([
                'message' => 'Impersonation session has expired or timed out.',
                'code'    => 'IMPERSONATION_TIMEOUT',
            ], 401);
        }

        $idleTimeout = (int) ($session['idle_timeout_seconds'] ?? self::DEFAULT_IDLE_TIMEOUT_SECONDS);
        $lastActivity = (int) ($session['last_activity_at'] ?? $session['started_at'] ?? 0);
        $idleDuration = now()->timestamp - $lastActivity;

        // 1. Check Idle / Inactivity Timeout
        if ($idleDuration > $idleTimeout) {
            $token->delete();
            Cache::forget($sessionKey);

            try {
                AuditLog::create([
                    'user_id'       => $session['admin_id'] ?? null,
                    'action'        => 'user.impersonation_timed_out',
                    'resource_type' => 'user',
                    'resource_id'   => (string) $user->id,
                    'metadata'      => [
                        'reason'        => 'inactivity',
                        'idle_seconds'  => $idleDuration,
                        'idle_timeout'  => $idleTimeout,
                        'target_user'   => $user->email,
                    ],
                    'ip_address'    => $request->ip(),
                    'user_agent'    => $request->userAgent(),
                ]);
            } catch (\Throwable) {}

            return response()->json([
                'message' => 'Impersonation session timed out due to admin inactivity.',
                'code'    => 'IMPERSONATION_TIMEOUT',
            ], 401);
        }

        // 2. Check if the Admin's login session has timed out or logged out
        $adminId = $session['admin_id'] ?? null;
        $adminTokenId = $session['admin_token_id'] ?? null;

        if ($adminId) {
            $admin = User::find($adminId);
            if (! $admin || $admin->status !== 'active' || $admin->role !== 'admin' || empty($admin->admin_role)) {
                $token->delete();
                Cache::forget($sessionKey);

                return response()->json([
                    'message' => 'The authorizing admin account is no longer active.',
                    'code'    => 'ADMIN_SESSION_EXPIRED',
                ], 401);
            }

            if ($adminTokenId) {
                $adminToken = PersonalAccessToken::find($adminTokenId);
                // If admin logged out (token deleted) or token expired
                if (! $adminToken || ($adminToken->expires_at && $adminToken->expires_at->isPast())) {
                    $token->delete();
                    Cache::forget($sessionKey);

                    try {
                        AuditLog::create([
                            'user_id'       => $adminId,
                            'action'        => 'user.impersonation_revoked',
                            'resource_type' => 'user',
                            'resource_id'   => (string) $user->id,
                            'metadata'      => [
                                'reason'      => 'admin_session_ended',
                                'target_user' => $user->email,
                            ],
                            'ip_address'    => $request->ip(),
                            'user_agent'    => $request->userAgent(),
                        ]);
                    } catch (\Throwable) {}

                    return response()->json([
                        'message' => 'Admin session has expired or logged out. Impersonation ended.',
                        'code'    => 'ADMIN_SESSION_EXPIRED',
                    ], 401);
                }
            }
        }

        // 3. Update Activity Timestamp
        $session['last_activity_at'] = now()->timestamp;
        Cache::put($sessionKey, $session, now()->addHours(2));

        return $next($request);
    }

    /**
     * Enforce an impersonation held in the web session.
     *
     * Ends in one of two ways. A timeout (absolute or idle) hands the session
     * back to the administrator. An administrator who has lost rights, or whose
     * MFA session has ended, takes the whole session with them.
     */
    private function enforceSession(Request $request, Closure $next): Response
    {
        $now = now()->timestamp;
        $adminId = ImpersonationSession::impersonatorId($request);
        $targetId = ImpersonationSession::targetId($request);
        $startedAt = (int) $request->session()->get(ImpersonationSession::STARTED_KEY, 0);
        $lastActivity = (int) $request->session()->get(ImpersonationSession::ACTIVITY_KEY, 0);

        $admin = $adminId ? User::find($adminId) : null;
        $adminTokenId = ImpersonationSession::adminTokenId($request);

        if (! $admin || ! ImpersonationSession::adminStillAuthorised($admin, $adminTokenId)) {
            ImpersonationSession::audit($adminId, 'user.impersonation_revoked', (int) $targetId, $request, [
                'reason' => 'admin_session_ended',
            ]);
            ImpersonationSession::abandon($request);

            return response()->json([
                'message' => 'The authorizing admin session has expired or lost its rights. Impersonation ended.',
                'code'    => 'ADMIN_SESSION_EXPIRED',
            ], 401);
        }

        $idle = $now - $lastActivity;
        $age = $now - $startedAt;

        if ($age > ImpersonationSession::MAX_SECONDS || $idle > ImpersonationSession::IDLE_SECONDS) {
            $reason = $age > ImpersonationSession::MAX_SECONDS ? 'time_limit' : 'inactivity';

            ImpersonationSession::audit($adminId, 'user.impersonation_timed_out', (int) $targetId, $request, [
                'reason'       => $reason,
                'age_seconds'  => $age,
                'idle_seconds' => $idle,
            ]);
            ImpersonationSession::stop($request);

            return response()->json([
                'message' => 'Impersonation session timed out.',
                'code'    => 'IMPERSONATION_TIMEOUT',
            ], 401);
        }

        $request->session()->put(ImpersonationSession::ACTIVITY_KEY, $now);

        return $next($request);
    }
}
