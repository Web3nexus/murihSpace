<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QueueMonitorTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_fetch_queue_stats_and_system_info_without_redis_error(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        Sanctum::actingAs($admin);

        $statsRes = $this->getJson('/api/v1/securegate/queue/stats');
        $statsRes->assertStatus(200);
        $this->assertArrayHasKey('pending', $statsRes->json('data.data') ?? $statsRes->json('data'));

        $sysRes = $this->getJson('/api/v1/securegate/queue/system-info');
        $sysRes->assertStatus(200);
        $sysData = $sysRes->json('data.data') ?? $sysRes->json('data');
        $this->assertArrayHasKey('php_version', $sysData);
        $this->assertArrayHasKey('redis_connected', $sysData);
        $this->assertFalse($sysData['redis_connected']);
    }
}

