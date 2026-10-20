<?php

namespace App\Support;

use RuntimeException;

/**
 * The LiveKit server address the apps connect to. It comes only from LIVEKIT_HOST: there is no
 * fallback domain, so a missing value fails loudly instead of sending calls to the wrong server.
 */
class LiveKitUrl
{
    /** The configured host as a websocket URL (wss:// or ws://). */
    public static function websocket(): string
    {
        $host = rtrim(trim((string) config('livekit.host')), '/');
        if ($host === '') {
            throw new RuntimeException('LIVEKIT_HOST is not set.');
        }

        return match (true) {
            str_starts_with($host, 'https://') => 'wss://'.substr($host, 8),
            str_starts_with($host, 'http://') => 'ws://'.substr($host, 7),
            default => $host,
        };
    }
}
