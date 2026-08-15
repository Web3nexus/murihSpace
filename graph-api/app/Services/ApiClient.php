<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\ServerException;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Request as GuzzleRequest;
use GuzzleHttp\Psr7\Response as GuzzleResponse;
use App\Exceptions\ServiceUnavailableException;
use App\Exceptions\UnauthorizedException;
use Illuminate\Support\Facades\Log;

/**
 * Abstract base service client with retry, timeout, and X-Request-ID propagation.
 * Concrete clients extend this and call get() / post() / patch() / delete().
 */
abstract class ApiClient
{
    protected Client $http;

    /** Override in concrete clients */
    abstract protected function baseUrl(): string;

    /** Short-lived service token for service-to-service authentication */
    abstract protected function serviceToken(): string;

    protected function client(): Client
    {
        if (isset($this->http)) {
            return $this->http;
        }

        $stack = HandlerStack::create();
        $stack->push($this->retryMiddleware());

        $this->http = new Client([
            'base_uri'        => rtrim($this->baseUrl(), '/') . '/',
            'timeout'         => 10,
            'connect_timeout' => 5,
            'handler'         => $stack,
            'headers'         => [
                'Accept'       => 'application/json',
                'Content-Type' => 'application/json',
            ],
        ]);

        return $this->http;
    }

    protected function get(string $path, array $query = [], ?string $bearerToken = null): array
    {
        return $this->request('GET', $path, ['query' => $query], $bearerToken);
    }

    protected function post(string $path, array $body = [], ?string $bearerToken = null): array
    {
        return $this->request('POST', $path, ['json' => $body], $bearerToken);
    }

    private function request(string $method, string $path, array $options = [], ?string $bearerToken = null): array
    {
        $options['headers'] = array_merge($options['headers'] ?? [], [
            'X-Request-ID'  => app('graph.request_id', 'unknown'),
            'X-Service-From' => 'graph-api',
            'Authorization' => 'Bearer ' . ($bearerToken ?? $this->serviceToken()),
        ]);

        try {
            $response = $this->client()->request($method, ltrim($path, '/'), $options);
            $body     = json_decode((string) $response->getBody(), true) ?? [];

            if ($response->getStatusCode() === 401) {
                throw new UnauthorizedException('Downstream service returned 401');
            }

            return $body;
        } catch (ConnectException $e) {
            Log::error('Service connect failure', ['service' => $this->baseUrl(), 'error' => $e->getMessage()]);
            throw new ServiceUnavailableException("Could not connect to downstream service: {$this->baseUrl()}", 0, $e);
        } catch (ServerException $e) {
            Log::error('Downstream server error', ['service' => $this->baseUrl(), 'status' => $e->getCode()]);
            throw new ServiceUnavailableException("Downstream service error: {$this->baseUrl()}", 0, $e);
        }
    }

    private function retryMiddleware(): callable
    {
        return Middleware::retry(
            decider: function (int $retries, GuzzleRequest $request, ?GuzzleResponse $response, ?\Throwable $exception) {
                if ($retries >= 2) {
                    return false;
                }
                // Retry on connection failures or 503
                if ($exception instanceof ConnectException) {
                    return true;
                }
                if ($response && $response->getStatusCode() === 503) {
                    return true;
                }
                return false;
            },
            delay: fn (int $retries) => 200 * (2 ** ($retries - 1)), // 200ms, 400ms
        );
    }
}
