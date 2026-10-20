<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restricts a route to the super admin. Used for payment provider credentials and
 * routing, which no other staff role may view or change, whatever permissions it holds.
 */
class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only the super admin can manage payment providers.',
            ], 403);
        }

        return $next($request);
    }
}
