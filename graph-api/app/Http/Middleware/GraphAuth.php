<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Services\MainApiClient;

/**
 * Validates the Bearer token by forwarding it to the Main backend's
 * /api/user endpoint. On success the authenticated user payload is
 * stored on the request attributes for downstream controllers.
 */
class GraphAuth
{
    public function __construct(private readonly MainApiClient $mainApi) {}

    public function handle(Request $request, Closure $next): mixed
    {
        $authHeader = $request->header('Authorization', '');

        if (!preg_match('/^Bearer\s+(.+)$/', $authHeader, $matches)) {
            return $this->unauthenticated($request, 'Missing or invalid Authorization header.');
        }

        $token = $matches[1];

        try {
            // Forward the token to Main backend to verify identity
            $user = $this->mainApi->getAuthenticatedUser($token);
        } catch (\App\Exceptions\ServiceUnavailableException $e) {
            return $this->error($request, 'SERVICE_UNAVAILABLE', 'Authentication service is temporarily unavailable.', 503);
        } catch (\App\Exceptions\UnauthorizedException) {
            return $this->unauthenticated($request, 'Invalid or expired access token.');
        }

        // Make user available to all downstream controllers
        $request->attributes->set('graph_user', $user);
        $request->attributes->set('graph_user_id', $user['id'] ?? null);

        return $next($request);
    }

    private function unauthenticated(Request $request, string $message): \Illuminate\Http\JsonResponse
    {
        return $this->error($request, 'UNAUTHENTICATED', $message, Response::HTTP_UNAUTHORIZED);
    }

    private function error(Request $request, string $code, string $message, int $status): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'error' => [
                'code'       => $code,
                'message'    => $message,
                'request_id' => $request->header('X-Request-ID'),
            ],
        ], $status);
    }
}
