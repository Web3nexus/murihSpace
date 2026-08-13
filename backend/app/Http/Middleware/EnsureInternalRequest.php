<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

class EnsureInternalRequest
{
    /**
     * Protect service-to-service routes. Requests must present a valid
     * `X-Internal-Token`, a `X-Timestamp` inside the replay window and a
     * `X-Nonce` that has not been seen before.
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

        $this->enforceIpAllowList($request);
        $this->enforceRateLimit();
        $this->enforceTimestamp($request);
        $this->enforceNonce($request);

        return $next($request);
    }

    private function enforceIpAllowList(Request $request): void
    {
        $allowed = config('internal.allowed_ips', []);
        if (empty($allowed)) {
            return;
        }

        if (! in_array($request->ip(), $allowed, true)) {
            throw new AccessDeniedHttpException('Source IP not allowed.');
        }
    }

    private function enforceRateLimit(): void
    {
        $limit = (int) config('internal.rate_limit.attempts', 300);
        $decay = (int) config('internal.rate_limit.decay', 60);

        $key = 'internal-api:'.sha1((string) config('internal.token'));

        if (RateLimiter::tooManyAttempts($key, $limit)) {
            throw new TooManyRequestsHttpException(
                RateLimiter::availableIn($key),
                'Too many internal API requests.',
            );
        }

        RateLimiter::hit($key, $decay);
    }

    private function enforceTimestamp(Request $request): void
    {
        $timestamp = $request->header('X-Timestamp');
        $window = (int) config('internal.replay_window', 300);

        if (! is_numeric($timestamp)) {
            throw new HttpException(400, 'Missing or invalid timestamp.');
        }

        $age = abs((int) $timestamp - now()->getTimestamp());

        if ($age > $window) {
            throw new HttpException(400, 'Request timestamp is outside the allowed window.');
        }
    }

    private function enforceNonce(Request $request): void
    {
        $nonce = (string) $request->header('X-Nonce', '');

        if (strlen($nonce) < 16 || strlen($nonce) > 128) {
            throw new HttpException(400, 'Missing or invalid nonce.');
        }

        $window = (int) config('internal.replay_window', 300);
        $key = 'internal-api:nonce:'.sha1($nonce);

        if (Cache::has($key)) {
            throw new HttpException(400, 'Nonce already used.');
        }

        Cache::put($key, true, $window);
    }
}
