<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ensures the authenticated user is a vendor (or admin).
 * Used to restrict vendor-only routes.
 */
class IsVendor
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role, ['vendor', 'admin'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Vendor access required.',
            ], 403);
        }

        return $next($request);
    }
}
