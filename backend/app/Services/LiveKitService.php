<?php

namespace App\Services;

use Firebase\JWT\JWT;

class LiveKitService
{
    public function isConfigured(): bool
    {
        $apiKey = config('livekit.api_key') ?: env('LIVEKIT_API_KEY');
        $apiSecret = config('livekit.api_secret') ?: env('LIVEKIT_API_SECRET');

        if (! empty($apiKey) && ! empty($apiSecret)) {
            return true;
        }

        return app()->environment('local', 'testing');
    }

    public function generateToken(
        string $identity,
        string $roomName,
        ?string $metadata = null,
        bool $canPublish = true,
        bool $canSubscribe = true,
        ?string $name = null,
        bool $roomAdmin = false,
        ?int $ttlSeconds = null,
    ): string {
        // HS256 requires key length of at least 256 bits (32 bytes) in firebase/php-jwt
        [$apiKey, $apiSecret] = $this->credentials();

        $now = time();
        $payload = [
            'exp' => $now + ($ttlSeconds ?: 7200),
            'iss' => $apiKey,
            'nbf' => $now,
            'sub' => $identity,
            'video' => [
                'room' => $roomName,
                'roomJoin' => true,
                'canPublish' => $canPublish,
                'canSubscribe' => $canSubscribe,
            ],
        ];

        // `roomAdmin` is what lets the holder drive other participants through
        // LiveKit's server API (mute / remove). It is only ever granted to the
        // meeting host or live host, never to attendees.
        if ($roomAdmin) {
            $payload['video']['roomAdmin'] = true;
        }

        if ($name) {
            $payload['name'] = $name;
        }

        if ($metadata) {
            $payload['metadata'] = $metadata;
        }

        return JWT::encode($payload, $apiSecret, 'HS256');
    }

    /**
     * Short-lived credential used by the server when calling LiveKit's own
     * room administration API. It carries `roomAdmin` and is bound to no room,
     * so it cannot be used to join or publish anywhere.
     */
    public function generateAdminToken(int $ttlSeconds = 900): string
    {
        [$apiKey, $apiSecret] = $this->credentials();

        $now = time();

        return JWT::encode([
            'iss' => $apiKey,
            'sub' => $apiKey,
            'nbf' => $now,
            'exp' => $now + $ttlSeconds,
            'jti' => (string) \Illuminate\Support\Str::uuid(),
            'video' => ['roomAdmin' => true],
        ], $apiSecret, 'HS256');
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function credentials(): array
    {
        $apiKey = config('livekit.api_key') ?: env('LIVEKIT_API_KEY');
        $apiSecret = config('livekit.api_secret') ?: env('LIVEKIT_API_SECRET');

        if (empty($apiKey) || empty($apiSecret)) {
            $apiKey = $apiKey ?: 'devkey';
            $apiSecret = $apiSecret ?: 'secret_for_local_dev_1234567890123';
        }

        if (strlen($apiSecret) < 32) {
            $apiSecret = str_pad($apiSecret, 32, '0');
        }

        return [(string) $apiKey, $apiSecret];
    }
}
