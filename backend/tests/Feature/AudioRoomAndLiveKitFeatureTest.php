<?php

namespace Tests\Feature;

use App\Models\AudioRoom;
use App\Models\AudioRoomParticipant;
use App\Models\Gift;
use App\Models\User;
use App\Services\Wallet\LedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AudioRoomAndLiveKitFeatureTest extends TestCase
{
    use RefreshDatabase;

    private User $host;
    private User $listener;

    protected function setUp(): void
    {
        parent::setUp();
        $this->host = User::factory()->create([
            'name' => 'Host User',
            'username' => 'hostuser',
            'role' => 'creator',
            'email_verified_at' => now(),
        ]);
        $this->listener = User::factory()->create([
            'name' => 'Listener User',
            'username' => 'listeneruser',
            'role' => 'member',
            'email_verified_at' => now(),
        ]);

        Config::set('livekit.host', 'https://test-livekit.murihspace.com');
        Config::set('livekit.api_key', 'LK_API_KEY_TEST_123');
        Config::set('livekit.api_secret', 'LK_API_SECRET_KEY_456_LONG_ENOUGH_TEST');
    }

    public function test_creator_can_create_and_manage_audio_room(): void
    {
        Sanctum::actingAs($this->host);

        // 1. Create Room
        $createRes = $this->postJson('/api/v1/audio-rooms', [
            'title' => 'Sunday Deep Dive with MurihSpace',
            'description' => 'A live audio conversation on the creator economy.',
            'max_participants' => 50,
        ]);

        $createRes->assertStatus(201);
        $roomData = $createRes->json('data.data') ?? $createRes->json('data');
        $this->assertEquals('Sunday Deep Dive with MurihSpace', $roomData['title']);
        $this->assertEquals($this->host->id, $roomData['creator_id']);

        $roomId = $roomData['id'];

        // 2. Start Room
        $startRes = $this->postJson("/api/v1/audio-rooms/{$roomId}/start");
        $startRes->assertOk();
        $startData = $startRes->json('data.data') ?? $startRes->json('data');
        $this->assertEquals('live', $startData['status']);

        // 3. Listener joins the room
        Sanctum::actingAs($this->listener);
        $joinRes = $this->postJson("/api/v1/audio-rooms/{$roomId}/join");
        $joinRes->assertOk();

        // 4. Listener requests LiveKit Token
        $tokenRes = $this->getJson("/api/v1/audio-rooms/{$roomId}/livekit-token");
        $tokenRes->assertOk();
        $tokenData = $tokenRes->json('data.data') ?? $tokenRes->json('data') ?? $tokenRes->json();
        $this->assertEquals('https://test-livekit.murihspace.com', $tokenData['host']);
        $this->assertEquals("audio-room-{$roomId}", $tokenData['room']);
        $this->assertNotEmpty($tokenData['token']);

        // 5. Listener raises hand
        $handRes = $this->postJson("/api/v1/audio-rooms/{$roomId}/raise-hand");
        $handRes->assertOk();

        $participant = AudioRoomParticipant::where('audio_room_id', $roomId)
            ->where('user_id', $this->listener->id)
            ->first();
        $this->assertTrue((bool) $participant->is_hand_raised);

        // 6. Host mutes listener / updates role
        Sanctum::actingAs($this->host);
        $muteRes = $this->postJson("/api/v1/audio-rooms/{$roomId}/users/{$this->listener->id}/mute");
        $muteRes->assertOk();

        // 7. Host ends room
        $endRes = $this->postJson("/api/v1/audio-rooms/{$roomId}/end");
        $endRes->assertOk();
        $endData = $endRes->json('data.data') ?? $endRes->json('data');
        $this->assertEquals('ended', $endData['status']);
    }

    public function test_unjoined_user_cannot_get_livekit_token(): void
    {
        $room = AudioRoom::create([
            'creator_id' => $this->host->id,
            'title' => 'Private Room',
            'status' => 'live',
        ]);

        Sanctum::actingAs($this->listener);
        $tokenRes = $this->getJson("/api/v1/audio-rooms/{$room->id}/livekit-token");
        $tokenRes->assertStatus(403);
    }

    public function test_sending_gift_inside_live_session_context(): void
    {
        // Credit listener system wallet
        (new LedgerService())->credit($this->listener, 500000, 'NGN', 'system', 'available', 'deposit');

        $gift = Gift::create([
            'name' => 'Super Star',
            'coin_price' => 50000, // ₦500
            'creator_earns' => 45000,
            'platform_commission' => 5000,
            'icon' => '⭐',
            'is_active' => true,
        ]);

        Sanctum::actingAs($this->listener);

        $giftRes = $this->postJson('/api/v1/gifts/send', [
            'gift_id' => $gift->id,
            'recipient_id' => $this->host->id,
            'session_id' => 'audio-room-session-999',
            'wallet_type' => 'system',
            'message' => 'Great session, host!',
        ]);

        $giftRes->assertStatus(201);
        $this->assertStringContainsString('Gift sent successfully', $giftRes->json('message') ?? '');

        // Check leaderboard for the live session
        $leaderboardRes = $this->getJson('/api/v1/gifts/leaderboard/audio-room-session-999');
        $leaderboardRes->assertOk();
    }
}
