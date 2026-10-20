<?php

namespace App\Http\Middleware;

use App\Support\AdminSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->role !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

        // A disabled administrator (for example a staff member removed in the marketing
        // backend) loses access on the next request, even with a token issued earlier.
        if ($user->trashed() || in_array($user->status, ['banned', 'suspended', 'deleted'], true)) {
            return response()->json([
                'message' => 'This administrator account is disabled.',
                'code' => 'admin_account_disabled',
            ], 403);
        }

        // A role check is not a session check. Administrators can still sign in
        // through the shared consumer login — they have to, because that is how a
        // second factor gets enrolled — and that session is a normal consumer
        // token. Admitting it here would let an administrator reach the whole
        // administration surface with a password alone, which is the bypass this
        // gate closes. Only a session issued by AdminAuthController, after a
        // second factor, carries the ability below.
        if (! AdminSession::clearedMfa($request)) {
            return response()->json([
                'message' => 'This administrator session has not cleared two-factor authentication. Sign in through the administration portal to continue.',
                'code' => 'admin_mfa_required',
            ], 403);
        }

        return $next($request);
    }
}
