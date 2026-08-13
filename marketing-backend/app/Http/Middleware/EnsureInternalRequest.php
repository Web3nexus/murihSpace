<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class EnsureInternalRequest
{
    /**
     * Verify the caller presents the shared internal token and a customer
     * email. Only the main application is allowed to hit these routes.
     */
    public function handle(Request $request, Closure $next): mixed
    {
        $token = config('internal.token');

        if (! $token || ! hash_equals($token, (string) $request->header('X-Internal-Token', ''))) {
            throw new AccessDeniedHttpException('Invalid internal token.');
        }

        $email = strtolower(trim((string) $request->header('X-Customer-Email', '')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpException(422, 'Missing or invalid customer email.');
        }

        $request->attributes->set('_customer_email', $email);

        return $next($request);
    }
}
