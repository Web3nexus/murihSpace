<?php

namespace App\Services;

use App\Services\Kyc\KycCredentials;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class SumsubService
{
    public function __construct(
        private readonly array $config = [],
    ) {
    }

    private function cfg(string $key): mixed
    {
        if (array_key_exists($key, $this->config)) {
            return $this->config[$key];
        }

        return KycCredentials::resolve('sumsub', $key, config("sumsub.{$key}"));
    }

    public function isEnabled(): bool
    {
        // Configured when credentials are present (env or admin settings).
        return $this->cfg('app_token') !== '' && $this->cfg('secret_key') !== '';
    }

    public function levelName(): string
    {
        return $this->cfg('level_name');
    }

    /**
     * Generate the HMAC-SHA256 signature for a Sumsub API request.
     */
    public function sign(string $method, string $path, string $body = ''): array
    {
        $ts = (string) time();
        $payload = $ts . strtoupper($method) . $path . $body;
        $sig = hash_hmac('sha256', $payload, $this->cfg('secret_key'));

        return [$ts, $sig];
    }

    /**
     * Send a signed request to the Sumsub API.
     *
     * @param  array<string, mixed>|null  $data
     * @return array<string, mixed>|null
     */
    public function request(string $method, string $path, ?array $data = null): ?array
    {
        $body = $data !== null ? json_encode($data) : '';
        [$ts, $sig] = $this->sign($method, $path, $body);

        $client = Http::baseUrl($this->cfg('base_url'))
            ->withHeaders([
                'X-App-Token' => $this->cfg('app_token'),
                'X-App-Access-Ts' => $ts,
                'X-App-Access-Sig' => $sig,
                'Accept' => 'application/json',
            ]);

        if ($data !== null) {
            $client->withHeaders(['Content-Type' => 'application/json']);
        }

        /** @var PendingRequest $client */
        $response = $client->send($method, $path, $data !== null ? ['json' => $data] : []);

        if (! $response->successful()) {
            return null;
        }

        return $response->json();
    }

    /**
     * Generate a short-lived access token for the Web SDK.
     *
     * @return array<string, mixed>|null
     */
    public function createAccessToken(string $externalUserId, ?string $levelName = null, ?int $ttlInSecs = null): ?array
    {
        $levelName = $levelName ?? $this->cfg('level_name');
        $ttlInSecs = $ttlInSecs ?? $this->cfg('token_ttl');

        $path = '/resources/accessTokens?userId=' . urlencode($externalUserId)
            . '&levelName=' . urlencode($levelName)
            . '&ttlInSecs=' . $ttlInSecs;

        return $this->request('POST', $path);
    }

    /**
     * Create a Sumsub applicant for an external user.
     *
     * @return array<string, mixed>|null
     */
    public function createApplicant(string $externalUserId, array $info = []): ?array
    {
        $data = array_filter([
            'externalUserId' => $externalUserId,
            'info' => $info ?: null,
        ], fn ($v) => $v !== null);

        $path = '/resources/applicants?levelName=' . urlencode($this->cfg('level_name'));

        return $this->request('POST', $path, $data);
    }

    /**
     * Fetch applicant status (reviewResult etc.).
     *
     * @return array<string, mixed>|null
     */
    public function applicantStatus(string $applicantId): ?array
    {
        return $this->request('GET', '/resources/applicants/' . urlencode($applicantId) . '/status');
    }

    /**
     * Fetch the full applicant record.
     *
     * @return array<string, mixed>|null
     */
    public function applicant(string $applicantId): ?array
    {
        return $this->request('GET', '/resources/applicants/' . urlencode($applicantId));
    }

    /**
     * Fetch inspection documents for an applicant.
     *
     * @return array<string, mixed>|null
     */
    public function inspectionDocuments(string $applicantId): ?array
    {
        return $this->request('GET', '/resources/inspections/' . urlencode($applicantId) . '/resources');
    }

    /**
     * Verify an inbound webhook payload using the configured webhook secret.
     */
    public function verifyWebhook(string $payload, ?string $digest, ?string $digestAlg = null): bool
    {
        $secret = (string) $this->cfg('webhook_secret');
        if ($secret === '' || $digest === null) {
            return false;
        }

        $expected = match (strtoupper((string) $digestAlg)) {
            'HMAC_SHA1_HEX' => hash_hmac('sha1', $payload, $secret),
            default => hash_hmac('sha256', $payload, $secret),
        };

        return hash_equals($expected, strtolower($digest));
    }
}
