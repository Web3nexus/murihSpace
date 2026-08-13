<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class MainBackendService
{
    /**
     * Fetch a combined support snapshot for a customer.
     *
     * @return array<string, mixed>|null null when the user does not exist
     */
    public function userSummary(int $userId): ?array
    {
        return $this->get("/internal/support/users/{$userId}/summary");
    }

    /**
     * Resolve a customer from their account email (e.g. from a ticket).
     *
     * @return array<string, mixed>|null null when the user does not exist
     */
    public function userByEmail(string $email): ?array
    {
        return $this->get('/internal/support/users/by-email/'.urlencode($email));
    }

    /**
     * @return array<int, mixed>|null
     */
    public function userTransactions(int $userId): ?array
    {
        return $this->get("/internal/support/users/{$userId}/transactions");
    }

    /**
     * @return array<int, mixed>|null
     */
    public function userOrders(int $userId): ?array
    {
        return $this->get("/internal/support/users/{$userId}/orders");
    }

    /**
     * @return array<int, mixed>|null
     */
    public function userSubscriptions(int $userId): ?array
    {
        return $this->get("/internal/support/users/{$userId}/subscriptions");
    }

    /**
     * @return array<string, mixed>|null
     */
    public function userWalletSummary(int $userId): ?array
    {
        return $this->get("/internal/support/users/{$userId}/wallet-summary");
    }

    /**
     * @return array<string, mixed>|null
     */
    public function userKycSummary(int $userId): ?array
    {
        return $this->get("/internal/support/users/{$userId}/kyc-summary");
    }

    /**
     * @return array<string, mixed>|null
     */
    public function transactionSummary(int $transactionId): ?array
    {
        return $this->get("/internal/support/transactions/{$transactionId}/summary");
    }

    /**
     * @return array<string, mixed>|null
     */
    public function orderSummary(int $orderId): ?array
    {
        return $this->get("/internal/support/orders/{$orderId}");
    }

    /**
     * Push a ticket lifecycle notification to a customer (in-app + email where
     * enabled) via the main backend's internal API. Best-effort: returns false
     * (never throws) when the platform is unreachable or the customer has no
     * account there.
     *
     * @param  array<string, mixed>  $payload
     */
    public function notifyCustomer(array $payload): bool
    {
        $result = $this->post('/internal/support/notifications', $payload);

        return is_array($result)
            && ($result['delivered'] ?? false) === true;
    }

    /**
     * Perform a signed POST against the main backend internal API.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>|null
     */
    private function post(string $path, array $payload): ?array
    {
        $token = (string) config('services.main_backend.token');
        if (! $token) {
            return null;
        }

        try {
            $response = Http::baseUrl((string) config('services.main_backend.base_url'))
                ->withHeaders($this->signingHeaders($token))
                ->timeout(10)
                ->post($path, $payload);
        } catch (ConnectionException) {
            return null;
        }

        if ($response->clientError() || $response->serverError()) {
            return null;
        }

        $body = $response->json();

        return is_array($body) ? $body : null;
    }

    /**
     * Perform a signed GET against the main backend internal API.
     *
     * Each request gets a fresh nonce and a current timestamp, satisfying the
     * replay-window checks enforced by the `internal` middleware. Failures or
     * missing resources yield null so callers can degrade gracefully.
     *
     * @return array<string, mixed>|null
     */
    private function get(string $path): ?array
    {
        $token = (string) config('services.main_backend.token');
        if (! $token) {
            return null;
        }

        try {
            $response = Http::baseUrl((string) config('services.main_backend.base_url'))
                ->withHeaders($this->signingHeaders($token))
                ->timeout(10)
                ->get($path);
        } catch (ConnectionException) {
            return null;
        }

        if ($response->clientError() || $response->serverError()) {
            return null;
        }

        $payload = $response->json();

        return is_array($payload) ? $payload : null;
    }

    /**
     * @return array<string, string>
     */
    private function signingHeaders(string $token): array
    {
        return [
            'X-Internal-Token' => $token,
            'X-Timestamp' => (string) now()->getTimestamp(),
            'X-Nonce' => $this->freshNonce(),
        ];
    }

    private function freshNonce(): string
    {
        return bin2hex(random_bytes(24));
    }
}
