<?php

namespace App\Http\Middleware;

use App\Services\PermissionService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Parameterised permission middleware.
 *
 * Usage in routes:
 *   ->middleware('permission:storefront.manage')
 *   ->middleware('permission:community.create,event.create')  // any one grants access
 */
class RequiresPermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        // Admins bypass all permission checks
        if ($user->role === 'admin') {
            return $next($request);
        }

        // Check that the user's role holds at least one of the required permissions
        foreach ($permissions as $permission) {
            if (PermissionService::roleHas($user->role, $permission)) {
                return $next($request);
            }
        }

        return response()->json([
            'success' => false,
            'message' => 'Forbidden. You do not have permission to perform this action.',
            'required_permissions' => $permissions,
            'your_role' => $user->role,
        ], 403);
    }
}
