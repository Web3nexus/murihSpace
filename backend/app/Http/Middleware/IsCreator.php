<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IsCreator
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isCreatorOrAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Creator or Administrator access required.',
            ], 403);
        }

        return $next($request);
    }
}
