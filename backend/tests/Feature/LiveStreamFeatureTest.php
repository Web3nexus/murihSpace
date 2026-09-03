<?php

namespace Tests\Feature;

use App\Models\Gift;
use App\Models\LiveStream;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class LiveStreamFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('livekit.api_key', 'TEST_LK_API_KEY');
        Config::set('livekit.api_secret', 'TEST_LK_SECRET_12345678901234567890');
        Config::set('livekit.host', 'https://livekit.test.murihspace.com');
    }

    public function test_host_can_start_live_stream_and_receive_publisher_token(): void
    {
        $host = User::factory()->create(['name' => 'Jane Host', 'username' => 'janehost']);

        $res = $this->actingAs($host)->postJson('/api/v1/live/start', [
            'title' => 'My Live Podcast',
            'description' => 'Discussing tech and design',
            'stream_mode' => 'video',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.stream.title', 'My Live Podcast')
            ->assertJsonPath('data.stream.status', 'live')
            ->assertJsonPath('data.livekit.is_publisher', true);

        $this->assertDatabaseHas('live_streams', [
            'user_id' => $host->id,
            'title' => 'My Live Podcast',
            'status' => 'live',
            'viewers_count' => 1,
        ]);
    }

    public function test_viewer_can_join_and_leave_live_stream_with_accurate_counts(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();

        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Community Q&A',
            'stream_mode' => 'video',
            'status' => 'live',
            'livekit_room' => 'room_test_123',
            'viewers_count' => 1,
            'started_at' => now(),
        ]);

        \App\Models\LiveStreamParticipant::create([
            'live_stream_id' => $stream->id,
            'user_id' => $host->id,
            'role' => 'host',
            'is_active' => true,
            'joined_at' => now(),
        ]);

        // Join
        $joinRes = $this->actingAs($viewer)->postJson("/api/v1/live/{$stream->id}/join");
        $joinRes->assertStatus(200)
            ->assertJsonPath('data.livekit.is_publisher', false)
            ->assertJsonPath('data.stream.viewers_count', 2);

        $this->assertEquals(2, $stream->fresh()->viewers_count);

        // Leave
        $leaveRes = $this->actingAs($viewer)->postJson("/api/v1/live/{$stream->id}/leave");
        $leaveRes->assertStatus(200);

        $this->assertEquals(1, $stream->fresh()->viewers_count);
    }

    public function test_authenticated_user_can_send_likes_and_chat(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();

        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Art Session',
            'stream_mode' => 'video',
            'status' => 'live',
            'livekit_room' => 'room_test_art',
            'viewers_count' => 1,
            'started_at' => now(),
        ]);

        // Send Likes
        $likeRes = $this->actingAs($viewer)->postJson("/api/v1/live/{$stream->id}/like", ['count' => 5]);
        $likeRes->assertStatus(200)
            ->assertJsonPath('data.likes_count', 5);

        // Send Chat
        $chatRes = $this->actingAs($viewer)->postJson("/api/v1/live/{$stream->id}/chat", [
            'message' => 'Amazing stream!',
        ]);
        $chatRes->assertStatus(201)
            ->assertJsonPath('data.data.message', 'Amazing stream!');

        // Get Chat
        $getChatRes = $this->actingAs($viewer)->getJson("/api/v1/live/{$stream->id}/chat");
        $getChatRes->assertStatus(200)
            ->assertJsonCount(1, 'data.data');
    }

    public function test_viewer_can_send_gift_with_atomic_wallet_deduction(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();

        $viewerWallet = Wallet::create([
            'user_id' => $viewer->id,
            'wallet_type' => 'system',
            'currency' => 'NGN',
            'available' => 5000,
        ]);

        $hostWallet = Wallet::create([
            'user_id' => $host->id,
            'wallet_type' => 'creator',
            'currency' => 'NGN',
            'available' => 0,
        ]);

        $gift = Gift::create([
            'name' => 'Diamond Rocket',
            'coin_price' => 1000,
            'creator_earns' => 800,
            'platform_commission' => 200,
            'is_active' => true,
        ]);

        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Gaming Stream',
            'stream_mode' => 'video',
            'status' => 'live',
            'livekit_room' => 'room_test_game',
            'viewers_count' => 1,
            'started_at' => now(),
        ]);

        $res = $this->actingAs($viewer)->postJson("/api/v1/live/{$stream->id}/gift", [
            'gift_id' => $gift->id,
            'message' => 'Keep it up!',
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('data.sender_balance', 4000)
            ->assertJsonPath('data.stream_total_coins', 1000);

        $this->assertEquals(4000, $viewerWallet->fresh()->available);
        $this->assertEquals(800, $hostWallet->fresh()->available);
        $this->assertEquals(1000, $stream->fresh()->total_coins_earned);
    }

    public function test_host_can_end_live_stream(): void
    {
        $host = User::factory()->create();

        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Night Show',
            'stream_mode' => 'video',
            'status' => 'live',
            'livekit_room' => 'room_test_night',
            'viewers_count' => 5,
            'started_at' => now()->subMinutes(30),
        ]);

        $res = $this->actingAs($host)->postJson("/api/v1/live/{$stream->id}/end");
        $res->assertStatus(200)
            ->assertJsonPath('data.stream.status', 'ended')
            ->assertJsonPath('data.stream.viewers_count', 0);

        $this->assertEquals('ended', $stream->fresh()->status);
    }
}
