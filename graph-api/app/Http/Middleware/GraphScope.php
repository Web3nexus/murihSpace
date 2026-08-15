<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware to enforce required scopes for a route.
 * Example usage: ->middleware(['graph.scope:profile.read'])
 */
class GraphScope
{
    /**
     * Handle an incoming request.
     *
     * @param  Request  $request
     * @param  Closure  $next
     * @param  string   $requiredScope
     * @return mixed
     */
    public function handle(Request $request, Closure $next, string $requiredScope)
    {
        // In a real implementation we would introspect the token (set by GraphAuth)
        // and verify that it contains the required scope. For now we assume all
        // tokens have all scopes.
        // TODO: Integrate with Main backend token introspection to fetch scopes.
        return $next($request);
    }
}
