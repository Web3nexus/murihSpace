<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

class EnsureSignedInternalRequest
{
    /**
     * Protect service-to-service webhook routes (e.g. the event ingest from the
     * main application). Requests must present a valid `X-Internal-Token`, a
     * `X-Timestamp` inside the replay window and a unique `X-Nonce`.
     */
    public function handle(Request $request, Closure $next): mixed
    {
        $token = (string) config('internal.token');

        if (! $token) {
            throw new AccessDeniedHttpException('Internal API is not configured.');
        }

        $presented = (string) $request->header('X-Internal-Token', '');
        if (! hash_equals($token, $presented)) {
            throw new AccessDeniedHttpException('Invalid internal token.');
        }

        $this->enforceRateLimit();

        $timestamp = $request->header('X-Timestamp');
        $window = 300;

        if (! is_numeric($timestamp) || abs((int) $timestamp - now()->getTimestamp()) > $window) {
            throw new HttpException(400, 'Request timestamp is outside the allowed window.');
        }

        $nonce = (string) $request->header('X-Nonce', '');
        if (strlen($nonce) < 16 || strlen($nonce) > 128) {
            throw new HttpException(400, 'Missing or invalid nonce.');
        }

        $key = 'internal-api:nonce:'.sha1('events-'.$nonce);

        if (! Cache::add($key, true, $window)) {
            throw new HttpException(400, 'Nonce already used.');
        }

        return $next($request);
    }

    private function enforceRateLimit(): void
    {
        $key = 'internal-api:events:'.sha1((string) config('internal.token'));

        if (RateLimiter::tooManyAttempts($key, 300)) {
            throw new TooManyRequestsHttpException(
                RateLimiter::availableIn($key),
                'Too many internal API requests.',
            );
        }

        RateLimiter::hit($key, 60);
    }
}
