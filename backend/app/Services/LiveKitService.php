<?php

namespace App\Services;

use Firebase\JWT\JWT;

class LiveKitService
{
    public function generateToken(
        string $identity,
        string $roomName,
        ?string $metadata = null,
        bool $canPublish = true,
        bool $canSubscribe = true,
        ?string $name = null,
    ): string {
        $apiKey = config('livekit.api_key');
        $apiSecret = config('livekit.api_secret');

        if (empty($apiKey) || empty($apiSecret)) {
            throw new \RuntimeException('LiveKit credentials not configured.');
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
