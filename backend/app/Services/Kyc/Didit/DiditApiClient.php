<?php

namespace App\Services\Kyc\Didit;

use App\Services\Kyc\KycCredentials;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DiditApiClient
{
    public function __construct(
        private readonly array $config = [],
    ) {}

    private function cfg(string $key): mixed
    {
        if (array_key_exists($key, $this->config)) {
            return $this->config[$key];
        }

        return KycCredentials::resolve('didit', $key, config("kyc.didit.{$key}"));
    }

    public function isEnabled(): bool
    {
        // Configured when credentials are present (env or admin settings).
        return $this->cfg('api_key') !== '' && $this->cfg('workflow_id') !== '';
    }

    public function workflowId(): string
    {
        return (string) $this->cfg('workflow_id');
    }

    public function baseUrl(): string
    {
        return rtrim((string) $this->cfg('base_url'), '/');
    }

    /**
     * Create a hosted verification session.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>|null
     */
    public function createSession(array $data): ?array
    {
        return $this->post('/v3/session/', $data);
    }

    /**
     * Fetch the decision for a session.
     *
     * @return array<string, mixed>|null
     */
    public function fetchDecision(string $sessionId): ?array
    {
        return $this->get('/v3/session/' . rawurlencode($sessionId) . '/decision/');
    }

    /**
     * Fetch the session itself (useful for status polling).
     *
     * @return array<string, mixed>|null
     */
    public function fetchSession(string $sessionId): ?array
    {
        return $this->get('/v3/session/' . rawurlencode($sessionId) . '/');
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function get(string $path): ?array
    {
        return $this->send('GET', $path);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>|null
     */
    protected function post(string $path, array $data): ?array
    {
        return $this->send('POST', $path, $data);
    }

    /**
     * @param  array<string, mixed>|null  $data
     * @return array<string, mixed>|null
     */
    protected function send(string $method, string $path, ?array $data = null): ?array
    {
        try {
            $request = Http::baseUrl($this->baseUrl())
                ->acceptJson()
                ->withToken((string) $this->cfg('api_key'))
                ->timeout((int) $this->cfg('timeout'));

            $response = $data !== null
                ? $request->{$method === 'POST' ? 'post' : 'get'}($path, $data)
                : $request->{$method === 'POST' ? 'post' : 'get'}($path);

            if (! $response->successful()) {
                Log::warning('Didit API request failed', [
                    'method' => $method,
                    'path' => $path,
                    'status' => $response->status(),
                    'body' => $this->sanitizeBody($response->body()),
                ]);

                return null;
            }

            return $response->json();
        } catch (ConnectionException|RequestException $e) {
            Log::warning('Didit API request error', [
                'method' => $method,
                'path' => $path,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Strip any credential-like values before logging.
     */
    private function sanitizeBody(string $body): string
    {
        return (string) preg_replace('/(key|token|secret)["\']?\s*[:=]\s*["\'][^"\']+["\']/i', '$1"=REDACTED"', $body);
    }
}
