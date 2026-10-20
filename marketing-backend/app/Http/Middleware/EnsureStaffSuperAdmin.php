<?php

namespace App\Http\Middleware;

use App\Models\StaffUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Allows only an active super admin, authenticated through the staff API guard.
 * Run after auth:staff_api.
 */
class EnsureStaffSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $staff = $request->user('staff_api');

        if (! $staff instanceof StaffUser || ! $staff->isActive() || ! $staff->isSuperAdmin()) {
            throw new HttpException(403, 'Super admin access required.');
        }

        return $next($request);
    }
}
