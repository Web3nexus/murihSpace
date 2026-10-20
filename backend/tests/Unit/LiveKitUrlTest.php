<?php

namespace Tests\Unit;

use App\Support\LiveKitUrl;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class LiveKitUrlTest extends TestCase
{
    public static function hosts(): array
    {
        return [
            'https becomes wss' => ['https://live.example.test', 'wss://live.example.test'],
            'http becomes ws' => ['http://localhost:7880', 'ws://localhost:7880'],
            'trailing slash is removed' => ['https://live.example.test/', 'wss://live.example.test'],
        ];
    }

    #[DataProvider('hosts')]
    public function test_the_configured_host_is_converted_to_a_websocket_url(string $host, string $expected): void
    {
        config(['livekit.host' => $host]);

        $this->assertSame($expected, LiveKitUrl::websocket());
    }

    public function test_a_missing_host_fails_instead_of_using_a_fallback(): void
    {
        config(['livekit.host' => null]);

        $this->expectException(RuntimeException::class);
        LiveKitUrl::websocket();
    }
}
