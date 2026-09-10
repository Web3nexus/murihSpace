<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IsStoreOwner
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isStoreOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Store owner access required (creator, vendor, or administrator).',
            ], 403);
        }

        return $next($request);
    }
}

