<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class AdminMiddleware
{
    /** Ability carried only by ads staff sessions created from a hub token. */
    public const ABILITY = 'ads:admin';

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $token = $user?->currentAccessToken();

        // Fails closed. Requires a staff account AND a token that carries the
        // ads:admin ability by name. Wildcard advertiser tokens ('*') do not count.
        $isStaff = $user !== null
            && $user->staff_hub_id !== null
            && $token instanceof PersonalAccessToken
            && in_array(self::ABILITY, $token->abilities ?? [], true);

        if (! $isStaff) {
            abort(403, 'Unauthorized. Admin access required.');
        }

        return $next($request);
    }
}
