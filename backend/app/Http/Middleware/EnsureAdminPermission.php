<?php

namespace App\Http\Middleware;

use App\Enums\AdminPermission;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards an administrator route with one or more permissions.
 *
 * Fails closed. A route that reaches this middleware without declaring a
 * permission is refused rather than allowed, so a misconfigured route is visibly
 * broken instead of silently granting every administrator access. See DEC-003.
 *
 * Multiple permissions are any-of: holding any one of them grants access.
 */
class EnsureAdminPermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isAdmin()) {
            return response()->json([
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

        if ($user->isSuperAdmin()) {
            return $next($request);
        }

        // Fail closed: no declared permission is a server-side misconfiguration.
        if ($permissions === []) {
            report(\RuntimeException::class.': admin route reached EnsureAdminPermission with no declared permission: '
                .$request->method().' '.$request->path());

            return response()->json([
                'message' => 'Forbidden. This administrative route is not configured with a permission.',
            ], 403);
        }

        $unknown = array_values(array_filter($permissions, fn (string $p) => ! AdminPermission::tryFrom($p)));

        if ($unknown !== []) {
            report(\RuntimeException::class.': admin route '.$request->method().' '.$request->path()
                .' declares unknown admin permission(s): '.implode(', ', $unknown));

            return response()->json([
                'message' => 'Forbidden. This administrative route is not configured correctly.',
            ], 403);
        }

        foreach ($permissions as $permission) {
            if ($user->hasAdminPermission($permission)) {
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'Forbidden. You do not have permission for this section.',
        ], 403);
    }
}
