<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Generates or propagates X-Request-ID on every request and response.
 * The ID is also injected into the log context for distributed tracing.
 */
class RequestId
{
    public function handle(Request $request, Closure $next): mixed
    {
        $id = $request->header('X-Request-ID') ?: 'req_' . Str::uuid()->toString();

        $request->headers->set('X-Request-ID', $id);

        // Bind the ID so controllers / services can access it
        app()->instance('graph.request_id', $id);

        // Add to log context for automatic inclusion in all log lines
        \Illuminate\Support\Facades\Log::withContext(['request_id' => $id]);

        $response = $next($request);

        $response->headers->set('X-Request-ID', $id);

        return $response;
    }
}
