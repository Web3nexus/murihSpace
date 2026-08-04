<?php

namespace App\Http\Middleware;

use App\Models\ActivityLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ActivityLogMiddleware
 *
 * Automatically records mutating API requests (POST, PUT, PATCH, DELETE) to the
 * activity_logs table for authenticated users. Silently skips on any error so it
 * never breaks the request pipeline.
 */
class ActivityLogMiddleware
{
    /**
     * Mutating HTTP verbs that should be logged.
     */
    private const LOGGED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    /**
     * Route patterns that should never be logged (webhooks, internal, health).
     */
    private const SKIP_PATTERNS = [
        'v1/ready',
        'v1/webhooks/',
        'v1/push-tokens',
        'v1/typing',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Only log mutating methods
        if (! in_array($request->method(), self::LOGGED_METHODS, true)) {
            return $response;
        }

        // Skip unauthenticated requests
        $user = $request->user();
        if (! $user) {
            return $response;
        }

        // Skip excluded patterns
        $path = $request->path();
        foreach (self::SKIP_PATTERNS as $pattern) {
            if (str_contains($path, $pattern)) {
                return $response;
            }
        }

        // Skip failed requests (validation errors, 500s) — we only log successful mutations
        $statusCode = $response->getStatusCode();
        if ($statusCode >= 400) {
            return $response;
        }

        try {
            ActivityLog::create([
                'user_id'    => $user->id,
                'action'     => $request->method() . ' ' . $path,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'metadata'   => null,
            ]);
        } catch (\Throwable) {
            // Never fail the request due to logging
        }

        return $response;
    }
}
