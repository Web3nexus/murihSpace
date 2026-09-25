<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MeetingTest extends TestCase
{
    use RefreshDatabase;

    private User $creator;
    private User $member;

    protected function setUp(): void
    {
        parent::setUp();

        $this->creator = User::factory()->create([
            'name' => 'Creator Host',
            'username' => 'creatorhost',
            'role' => 'creator',
            'email_verified_at' => now(),
        ]);

        $this->member = User::factory()->create([
            'name' => 'Member Attendee',
            'username' => 'memberattendee',
            'role' => 'member',
            'email_verified_at' => now(),
        ]);

        Config::set('livekit.host', 'https://test-livekit.murihspace.com');
        Config::set('livekit.api_key', 'LK_API_KEY_TEST_123');
        Config::set('livekit.api_secret', 'LK_API_SECRET_KEY_456_LONG_ENOUGH_TEST');
    }

    public function test_normal_member_cannot_host_instant_meeting(): void
    {
        Sanctum::actingAs($this->member);

        $response = $this->postJson('/api/v1/meetings/instant', [
            'title' => 'Member Meeting',
        ]);

        $response->assertStatus(403);
    }

    public function test_creator_can_host_instant_meeting(): void
    {
        Sanctum::actingAs($this->creator);

        $response = $this->postJson('/api/v1/meetings/instant', [
            'title' => 'Design Sync',
        ]);

        $response->assertStatus(200);

        $data = $response->json('data') ?? $response->json();
        $this->assertNotEmpty($data['code']);
        $this->assertNotEmpty($data['token']);
        $this->assertEquals('https://test-livekit.murihspace.com', $data['host']);
        $this->assertTrue($data['is_host']);
    }

    public function test_member_can_join_meeting_and_receive_token(): void
    {
        Sanctum::actingAs($this->member);

        $response = $this->getJson('/api/v1/meetings/kwy-aqgw-vhh/token');

        $response->assertStatus(200);

        $data = $response->json('data') ?? $response->json();
        $this->assertEquals('kwy-aqgw-vhh', $data['code']);
        $this->assertNotEmpty($data['token']);
        $this->assertEquals('https://test-livekit.murihspace.com', $data['host']);
        $this->assertFalse($data['is_host']);
    }
}
