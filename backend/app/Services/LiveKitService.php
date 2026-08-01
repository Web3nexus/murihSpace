<?php

namespace App\Services;

use Firebase\JWT\JWT;

class LiveKitService
{
    public function generateToken(string $identity, string $roomName, ?string $metadata = null): string
    {
        $apiKey = config('livekit.api_key');
        $apiSecret = config('livekit.api_secret');
        $host = config('livekit.host');

        if (empty($apiKey) || empty($apiSecret)) {
            throw new \RuntimeException('LiveKit credentials not configured.');
        }

        $now = time();
        $payload = [
            'exp' => $now + 3600,
            'iss' => $apiKey,
            'nbf' => $now,
            'sub' => $identity,
            'video' => [
                'room' => $roomName,
                'roomJoin' => true,
                'canPublish' => true,
                'canSubscribe' => true,
            ],
        ];

        if ($metadata) {
            $payload['metadata'] = $metadata;
        }

        return JWT::encode($payload, $apiSecret, 'HS256');
    }
}
