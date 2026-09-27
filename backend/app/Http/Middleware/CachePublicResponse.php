<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CachePublicResponse
{
    /**
     * The middleware argument is a TTL in seconds, matching Laravel's own
     * `cache.headers` convention. It used to be treated as minutes and
     * multiplied by 60, so every `cache.public:30` silently cached for 30
     * minutes instead of 30 seconds.
     */
    public function handle(Request $request, Closure $next, int $seconds = 60): Response
    {
        $response = $next($request);

        if ($response->isSuccessful() && $request->isMethod('GET')) {
            $response->setCache(['public' => true, 'max_age' => $seconds]);
            $response->headers->set('X-Cache-TTL', "{$seconds}s");
        }

        return $response;
    }
}
