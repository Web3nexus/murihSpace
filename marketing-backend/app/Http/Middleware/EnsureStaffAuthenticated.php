<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStaffAuthenticated
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user('staff')) {
            if ($request->expectsJson() || $request->is('api/*')) {
                throw new AuthenticationException('Unauthenticated.', ['staff']);
            }

            return redirect()->guest(route('securecrm.login'));
        }

        return $next($request);
    }
}
