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
        $staff = $request->user('staff');

        if (! $staff || ! $staff->isActive()) {
            if ($staff) {
                // A session belonging to a since-disabled account ends here.
                auth('staff')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            if ($request->expectsJson() || $request->is('api/*')) {
                throw new AuthenticationException('Unauthenticated.', ['staff']);
            }

            return redirect()->guest(route('securecrm.login'));
        }

        return $next($request);
    }
}
