<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CachePublicResponse
{
    public function handle(Request $request, Closure $next, int $minutes = 5): Response
    {
        $response = $next($request);

        if ($response->isSuccessful() && $request->isMethod('GET')) {
            $response->setCache(['public' => true, 'max_age' => $minutes * 60]);
            $response->headers->set('X-Cache-TTL', "{$minutes}m");
        }

        return $response;
    }
}
