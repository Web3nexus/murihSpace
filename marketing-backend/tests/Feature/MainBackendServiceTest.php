<?php

namespace Tests\Feature;

use App\Services\MainBackendService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MainBackendServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        Cache::flush();
        config(['services.main_backend.base_url' => 'http://backend.test', 'services.main_backend.token' => 'secret-token']);
    }

    public function test_user_summary_returns_payload_on_success(): void
    {
        Http::fake([
            'backend.test/internal/support/users/7/summary' => Http::response([
                'data' => ['id' => 7, 'name' => 'Ada'],
            ], 200),
        ]);

        $result = app(MainBackendService::class)->userSummary(7);

        $this->assertSame(['data' => ['id' => 7, 'name' => 'Ada']], $result);
    }

    public function test_requests_are_signed_with_token_timestamp_and_nonce(): void
    {
        Http::fake([
            'backend.test/internal/support/users/7/summary' => Http::response(['data' => []], 200),
        ]);

        app(MainBackendService::class)->userSummary(7);

        Http::assertSent(function (Request $request) {
            $token = (string) ($request->header('X-Internal-Token')[0] ?? '');
            $timestamp = (int) ($request->header('X-Timestamp')[0] ?? 0);
            $nonce = (string) ($request->header('X-Nonce')[0] ?? '');

            return hash_equals('secret-token', $token)
                && strlen($nonce) >= 16
                && abs($timestamp - time()) < 10;
        });
    }

    public function test_returns_null_when_resources_do_not_exist(): void
    {
        Http::fake([
            'backend.test/internal/support/users/404/summary' => Http::response([
                'data' => null,
                'message' => 'Not found',
            ], 404),
        ]);

        $this->assertNull(app(MainBackendService::class)->userSummary(404));
    }

    public function test_orders_endpoint_maps_to_route(): void
    {
        Http::fake([
            'backend.test/internal/support/users/7/orders' => Http::response(['data' => [['id' => 1]]], 200),
        ]);

        $result = app(MainBackendService::class)->userOrders(7);

        $this->assertSame(['data' => [['id' => 1]]], $result);
        Http::assertSent(fn (Request $request) => $request->url() === 'http://backend.test/internal/support/users/7/orders');
    }
}
