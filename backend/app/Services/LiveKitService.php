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
    ): string {
        $apiKey = config('livekit.api_key') ?: env('LIVEKIT_API_KEY');
        $apiSecret = config('livekit.api_secret') ?: env('LIVEKIT_API_SECRET');

        if (empty($apiKey) || empty($apiSecret)) {
            if (app()->environment('local', 'testing')) {
                $apiKey = $apiKey ?: 'devkey';
                $apiSecret = $apiSecret ?: 'secret_for_local_dev_1234567890123';
            } else {
                throw new \RuntimeException('LiveKit credentials not configured.');
            }
        }

        // HS256 requires key length of at least 256 bits (32 bytes) in firebase/php-jwt
        if (strlen($apiSecret) < 32) {
            $apiSecret = str_pad($apiSecret, 32, '0');
        }

        $now = time();
        $payload = [
            'exp' => $now + 7200, // 2 hours
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

        if ($name) {
            $payload['name'] = $name;
        }

        if ($metadata) {
            $payload['metadata'] = $metadata;
        }

        return JWT::encode($payload, $apiSecret, 'HS256');
    }
}
