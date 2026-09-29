<?php

namespace Tests\Feature;

use App\Models\Meeting;
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

        $this->assertDatabaseHas('meetings', [
            'code' => $data['code'],
            'host_user_id' => $this->creator->id,
            'room' => "meeting-{$data['code']}",
        ]);
    }

    public function test_member_can_join_meeting_and_receive_token(): void
    {
        Meeting::create([
            'code' => 'kwy-aqgw-vhh',
            'host_user_id' => $this->creator->id,
            'room' => 'meeting-kwy-aqgw-vhh',
            'title' => 'Design Sync',
            'expires_at' => now()->addHours(8),
        ]);

        Sanctum::actingAs($this->member);

        $response = $this->getJson('/api/v1/meetings/kwy-aqgw-vhh/token');

        $response->assertStatus(200);

        $data = $response->json('data') ?? $response->json();
        $this->assertEquals('kwy-aqgw-vhh', $data['code']);
        $this->assertNotEmpty($data['token']);
        $this->assertEquals('https://test-livekit.murihspace.com', $data['host']);
        $this->assertFalse($data['is_host']);
    }

    public function test_joining_an_unknown_meeting_code_returns_404(): void
    {
        Sanctum::actingAs($this->member);

        $response = $this->getJson('/api/v1/meetings/zzz-zzzz-zzz/token');

        $response->assertStatus(404);
        $this->assertStringContainsString('not found', strtolower($response->json('message')));
    }

    public function test_joining_an_expired_meeting_code_returns_404(): void
    {
        Meeting::create([
            'code' => 'old-abcd-efg',
            'host_user_id' => $this->creator->id,
            'room' => 'meeting-old-abcd-efg',
            'title' => 'Old Meeting',
            'expires_at' => now()->subMinutes(5),
        ]);

        Sanctum::actingAs($this->member);

        $response = $this->getJson('/api/v1/meetings/old-abcd-efg/token');

        $response->assertStatus(404);
    }

    public function test_host_and_guest_tokens_resolve_the_same_livekit_room(): void
    {
        Sanctum::actingAs($this->creator);

        $hostResponse = $this->postJson('/api/v1/meetings/instant', [
            'title' => 'Design Sync',
        ]);

        $hostResponse->assertStatus(200);

        $hostData = $hostResponse->json('data') ?? $hostResponse->json();
        $code = $hostData['code'];
        $this->assertNotEmpty($code);

        $hostRoom = $this->roomFromToken($hostData['token']);
        $this->assertEquals("meeting-{$code}", $hostRoom);

        Sanctum::actingAs($this->member);

        $guestResponse = $this->getJson("/api/v1/meetings/{$code}/token");

        $guestResponse->assertStatus(200);

        $guestData = $guestResponse->json('data') ?? $guestResponse->json();
        $guestRoom = $this->roomFromToken($guestData['token']);

        // Both sides must land in the SAME LiveKit room, otherwise a guest who
        // "joins" via invite link or code ends up in an empty meeting while the
        // host is left in their own room ("separate meetings").
        $this->assertEquals("meeting-{$code}", $guestRoom);
        $this->assertEquals($hostRoom, $guestRoom);
    }

    /**
     * Decode the LiveKit room name embedded in a host's or guest's JWT.
     */
    private function roomFromToken(string $jwt): string
    {
        $parts = explode('.', $jwt);
        $this->assertCount(3, $parts);

        $payload = json_decode($this->base64UrlDecode($parts[1]), true);
        $this->assertIsArray($payload);
        $this->assertArrayHasKey('video', $payload);
        $this->assertArrayHasKey('room', $payload['video']);

        return $payload['video']['room'];
    }

    private function base64UrlDecode(string $segment): string
    {
        $padding = (4 - strlen($segment) % 4) % 4;

        return base64_decode(strtr($segment, '-_', '+/').str_repeat('=', $padding));
    }
}
