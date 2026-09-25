<?php

namespace Tests\Feature;

use App\Models\Gift;
use App\Models\LiveStream;
use App\Models\LiveStreamParticipant;
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
        $host = User::factory()->create(['name' => 'Jane Host', 'username' => 'janehost', 'kyc_status' => 'verified']);

        $res = $this->actingAs($host)->postJson('/api/v1/live/start', [
            'title' => 'My Live Podcast',
            'description' => 'Discussing tech and design',
            'stream_mode' => 'video',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.stream.title', 'My Live Podcast')
            ->assertJsonPath('data.stream.status', 'live')
            ->assertJsonPath('data.livekit.is_publisher', true);

        $trackingId = $res->json('data.stream.tracking_id');
        $this->assertNotEmpty($trackingId);
        $this->assertSame(36, strlen($trackingId));

        $this->assertDatabaseHas('live_streams', [
            'user_id' => $host->id,
            'title' => 'My Live Podcast',
            'status' => 'live',
            'viewers_count' => 1,
        ]);
    }

    public function test_unverified_host_cannot_start_live_stream_without_kyc(): void
    {
        $host = User::factory()->create(['name' => 'Unverified Host', 'kyc_status' => 'pending']);

        $res = $this->actingAs($host)->postJson('/api/v1/live/start', [
            'title' => 'Attempted Stream',
            'stream_mode' => 'video',
        ]);

        $res->assertStatus(403);
        $this->assertStringContainsString('Identity verification (KYC) is required', $res->json('message'));

        $this->assertDatabaseMissing('live_streams', [
            'user_id' => $host->id,
            'title' => 'Attempted Stream',
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

        LiveStreamParticipant::create([
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

    public function test_public_tracking_link_records_a_session_click(): void
    {
        $host = User::factory()->create(['name' => 'Tracked Host']);
        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Tracked Broadcast',
            'stream_mode' => 'video',
            'status' => 'live',
            'livekit_room' => 'room_tracked_broadcast',
            'viewers_count' => 1,
            'started_at' => now(),
        ]);

        $response = $this
            ->withHeader('X-Live-Session-ID', 'visitor-session-001')
            ->getJson("/api/v1/live/resolve/{$stream->tracking_id}?utm_source=newsletter");

        $response->assertStatus(200)
            ->assertJsonPath('data.stream.id', $stream->id)
            ->assertJsonPath('data.stream.tracking_id', $stream->tracking_id)
            ->assertJsonPath('data.attribution.session_id', 'visitor-session-001')
            ->assertJsonPath('data.attribution.event', 'click');

        $this->assertDatabaseHas('live_stream_attributions', [
            'live_stream_id' => $stream->id,
            'session_id' => 'visitor-session-001',
            'click_count' => 1,
            'utm_source' => 'newsletter',
        ]);
    }

    public function test_live_tracking_ids_are_unique_and_legacy_links_resolve(): void
    {
        $host = User::factory()->create();
        $first = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'First Broadcast',
            'status' => 'live',
            'livekit_room' => 'room_first_tracking',
        ]);
        $second = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Second Broadcast',
            'status' => 'live',
            'livekit_room' => 'room_second_tracking',
        ]);

        $this->assertNotSame($first->tracking_id, $second->tracking_id);

        $legacyToken = rtrim(strtr(base64_encode("{$first->id}:{$host->id}"), '+/', '-_'), '=');
        $response = $this->getJson("/api/v1/live/{$legacyToken}/resolve");

        $response->assertStatus(200)
            ->assertJsonPath('data.stream.id', $first->id)
            ->assertJsonPath('data.legacy', true);
    }

    public function test_authenticated_join_preserves_anonymous_first_touch_attribution(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();
        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'First Touch Broadcast',
            'status' => 'live',
            'livekit_room' => 'room_first_touch',
        ]);
        $session = 'visitor-session-first-touch';

        $this->withHeader('X-Live-Session-ID', $session)
            ->withHeader('X-Client-Platform', 'web')
            ->getJson("/api/v1/live/resolve/{$stream->tracking_id}?utm_source=newsletter&utm_campaign=launch")
            ->assertOk();

        $this->withHeader('X-Live-Session-ID', $session)
            ->actingAs($viewer)
            ->postJson("/api/v1/live/{$stream->id}/join")
            ->assertOk();

        $attribution = $stream->attributions()->where('session_id', $session)->firstOrFail();
        $this->assertSame($viewer->id, $attribution->user_id);
        $this->assertSame('web', $attribution->source);
        $this->assertSame('newsletter', $attribution->utm_source);
        $this->assertSame('launch', $attribution->utm_campaign);
        $this->assertSame(1, $attribution->click_count);
        $this->assertSame(1, $attribution->join_count);
        $this->assertNull($attribution->left_at);
    }

    public function test_leave_before_join_does_not_count_as_a_lifecycle_transition(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();
        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Lifecycle Guard Broadcast',
            'status' => 'live',
            'livekit_room' => 'room_lifecycle_guard',
        ]);
        $session = 'visitor-session-leave-guard';

        $this->withHeader('X-Live-Session-ID', $session)
            ->actingAs($viewer)
            ->postJson("/api/v1/live/{$stream->id}/leave")
            ->assertOk();

        $attribution = $stream->attributions()->where('session_id', $session)->firstOrFail();
        $this->assertSame(0, $attribution->join_count);
        $this->assertSame(0, $attribution->leave_count);
        $this->assertNull($attribution->left_at);

        $this->withHeader('X-Live-Session-ID', $session)
            ->actingAs($viewer)
            ->postJson("/api/v1/live/{$stream->id}/join")
            ->assertOk();

        $attribution->refresh();
        $this->assertSame(1, $attribution->join_count);
        $this->assertSame(0, $attribution->leave_count);
        $this->assertNull($attribution->left_at);
    }

    public function test_heartbeat_accepts_a_sanctum_bearer_token_for_an_active_participant(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();
        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Bearer Broadcast',
            'status' => 'live',
            'livekit_room' => 'room_bearer_guard',
        ]);
        $token = $viewer->createToken('live-test')->plainTextToken;
        $session = 'visitor-session-bearer';

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->withHeader('X-Live-Session-ID', $session)
            ->postJson("/api/v1/live/{$stream->id}/join")
            ->assertOk();
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->withHeader('X-Live-Session-ID', $session)
            ->postJson("/api/v1/live/{$stream->id}/attribution", ['event' => 'heartbeat'])
            ->assertOk()
            ->assertJsonPath('data.attribution.event', 'heartbeat');
    }

    public function test_heartbeat_rejects_an_ended_stream(): void
    {
        $viewer = User::factory()->create();
        $stream = LiveStream::create([
            'user_id' => $viewer->id,
            'title' => 'Ended Broadcast',
            'status' => 'ended',
            'livekit_room' => 'room_ended_guard',
        ]);

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/live/{$stream->id}/attribution", ['event' => 'heartbeat'])
            ->assertStatus(410);

        $this->assertDatabaseMissing('live_stream_attributions', [
            'live_stream_id' => $stream->id,
        ]);
    }

    public function test_lifecycle_attribution_counts_only_state_transitions(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();
        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Lifecycle Broadcast',
            'status' => 'live',
            'livekit_room' => 'room_lifecycle_broadcast',
        ]);
        LiveStreamParticipant::create([
            'live_stream_id' => $stream->id,
            'user_id' => $host->id,
            'role' => 'host',
            'is_active' => true,
            'joined_at' => now(),
        ]);

        $session = 'visitor-session-lifecycle';
        $this->withHeader('X-Live-Session-ID', $session)
            ->actingAs($viewer)
            ->postJson("/api/v1/live/{$stream->id}/join")
            ->assertOk();
        $this->withHeader('X-Live-Session-ID', $session)
            ->actingAs($viewer)
            ->postJson("/api/v1/live/{$stream->id}/join")
            ->assertOk();
        $this->withHeader('X-Live-Session-ID', $session)
            ->actingAs($viewer)
            ->postJson("/api/v1/live/{$stream->id}/leave")
            ->assertOk();
        $this->withHeader('X-Live-Session-ID', $session)
            ->actingAs($viewer)
            ->postJson("/api/v1/live/{$stream->id}/leave")
            ->assertOk();
        $this->withHeader('X-Live-Session-ID', $session)
            ->actingAs($viewer)
            ->postJson("/api/v1/live/{$stream->id}/join")
            ->assertOk();

        $attribution = $stream->attributions()->where('session_id', $session)->firstOrFail();
        $this->assertSame(2, $attribution->join_count);
        $this->assertSame(1, $attribution->leave_count);
        $this->assertSame($viewer->id, $attribution->user_id);
    }

    public function test_attribution_endpoint_rejects_forged_lifecycle_events_and_inactive_heartbeats(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();
        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Attribution Guard Broadcast',
            'status' => 'live',
            'livekit_room' => 'room_attribution_guard',
        ]);
        LiveStreamParticipant::create([
            'live_stream_id' => $stream->id,
            'user_id' => $host->id,
            'role' => 'host',
            'is_active' => true,
            'joined_at' => now(),
        ]);

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/live/{$stream->id}/attribution", ['event' => 'join'])
            ->assertStatus(422);
        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/live/{$stream->id}/attribution", ['event' => 'leave'])
            ->assertStatus(422);
        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/live/{$stream->id}/attribution", ['event' => 'heartbeat'])
            ->assertStatus(403);

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/live/{$stream->id}/join")
            ->assertOk();
        $this->withHeader('X-Live-Session-ID', 'bearer-session-guard')
            ->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/live/{$stream->id}/attribution", ['event' => 'heartbeat'])
            ->assertOk()
            ->assertJsonPath('data.attribution.event', 'heartbeat');
    }

    public function test_host_can_view_live_attribution_analytics(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();
        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Analytics Broadcast',
            'status' => 'live',
            'livekit_room' => 'room_analytics_broadcast',
        ]);

        $this->withHeader('X-Live-Session-ID', 'visitor-session-analytics')
            ->getJson("/api/v1/live/resolve/{$stream->tracking_id}?utm_source=newsletter");

        $this->withHeader('X-Live-Session-ID', 'viewer-session-analytics')
            ->actingAs($viewer)
            ->postJson("/api/v1/live/{$stream->id}/join");

        $this->withHeader('X-Live-Session-ID', 'visitor-session-analytics')
            ->actingAs($viewer)
            ->postJson("/api/v1/live/{$stream->id}/attribution", ['event' => 'heartbeat']);

        $this->assertDatabaseHas('live_stream_attributions', [
            'live_stream_id' => $stream->id,
            'session_id' => 'visitor-session-analytics',
            'utm_source' => 'newsletter',
            'click_count' => 1,
        ]);

        $response = $this->actingAs($host)->getJson("/api/v1/live/{$stream->id}/analytics");

        $response->assertStatus(200)
            ->assertJsonPath('data.summary.sessions', 2)
            ->assertJsonPath('data.summary.unique_accounts', 1)
            ->assertJsonPath('data.summary.clicks', 1)
            ->assertJsonPath('data.summary.joined_sessions', 1)
            ->assertJsonCount(2, 'data.recent_sessions');
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
