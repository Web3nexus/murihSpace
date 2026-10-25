<?php

namespace App\Http\Middleware;

use App\Services\Kyc\Didit\DiditOwnershipVerifier;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks money movement for accounts imported from another app until the
 * person signing in has passed a selfie check against the account owner.
 */
class RequiresOwnershipConfirmation
{
    public function __construct(private readonly DiditOwnershipVerifier $ownership) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->requires_ownership_check) {
            return $next($request);
        }

        $token = $user->currentAccessToken();
        $tokenId = $token instanceof PersonalAccessToken ? $token->getKey() : null;

        if ($this->ownership->isConfirmedFor($user, $tokenId)) {
            return $next($request);
        }

        return response()->json([
            'message' => 'Confirm it is you with a quick selfie check before continuing.',
            'code' => 'OWNERSHIP_REQUIRED',
        ], 403);
    }
}
