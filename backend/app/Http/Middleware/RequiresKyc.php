<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequiresKyc
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if ($user->role === 'admin') {
            return $next($request);
        }

        if (! (bool) config('kyc.required_for_sellers', true)) {
            return $next($request);
        }

        if ($user->kyc_status !== 'verified') {
            return response()->json([
                'message' => 'Identity verification (KYC) is required to continue. Please complete verification first.',
                'code' => 'KYC_REQUIRED',
                'kyc_status' => $user->kyc_status ?? 'unsubmitted',
            ], 403);
        }

        return $next($request);
    }
}
