<?php

namespace Tests\Feature;

use App\Models\AudioRoom;
use App\Models\User;
use App\Services\LiveKit\RoomRecordingPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * End-to-end encrypted rooms (LiveKit E2EE): the server cannot decrypt media,
 * so recording must be skipped with a stated reason rather than failing.
 */
class E2eeRoomRecordingTest extends TestCase
{
    use RefreshDatabase;

    private User $host;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('livekit.host', 'https://livekit.test.murihspace.com');
        Config::set('livekit.api_key', 'TEST_LK_API_KEY');
        Config::set('livekit.api_secret', 'TEST_LK_SECRET_12345678901234567890');

        $this->host = User::factory()->create([
            'role' => 'creator',
            'kyc_status' => 'verified',
            'email_verified_at' => now(),
        ]);
    }

    public function test_policy_skips_recording_only_for_encrypted_rooms(): void
    {
        $this->assertNull(RoomRecordingPolicy::skipReason(false));
        $this->assertSame(RoomRecordingPolicy::SKIP_REASON_E2EE, RoomRecordingPolicy::skipReason(true));
        $this->assertNotNull(RoomRecordingPolicy::skipMessage(RoomRecordingPolicy::SKIP_REASON_E2EE));
        $this->assertNull(RoomRecordingPolicy::skipMessage(null));
    }

    public function test_recording_is_skipped_with_reason_for_encrypted_audio_room(): void
    {
        $res = $this->actingAs($this->host)->postJson('/api/v1/audio-rooms', [
            'title' => 'Private encrypted room',
            'is_recorded' => true,
            'e2ee' => true,
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.data.e2ee', true)
            ->assertJsonPath('data.data.is_recorded', false)
            ->assertJsonPath('data.recording_skipped.reason', RoomRecordingPolicy::SKIP_REASON_E2EE);

        $this->assertDatabaseHas('audio_rooms', [
            'title' => 'Private encrypted room',
            'e2ee' => true,
            'is_recorded' => false,
        ]);
    }

    public function test_recording_is_kept_for_unencrypted_audio_room(): void
    {
        $res = $this->actingAs($this->host)->postJson('/api/v1/audio-rooms', [
            'title' => 'Open room',
            'is_recorded' => true,
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.data.e2ee', false)
            ->assertJsonPath('data.data.is_recorded', true)
            ->assertJsonMissingPath('data.recording_skipped');
    }

    public function test_enabling_e2ee_on_a_recorded_room_skips_recording(): void
    {
        $room = AudioRoom::create([
            'creator_id' => $this->host->id,
            'title' => 'Recorded room',
            'status' => 'scheduled',
            'is_recorded' => true,
            'e2ee' => false,
        ]);

        $res = $this->actingAs($this->host)->putJson("/api/v1/audio-rooms/{$room->id}", [
            'e2ee' => true,
        ]);

        $res->assertOk()
            ->assertJsonPath('data.data.is_recorded', false)
            ->assertJsonPath('data.recording_skipped.reason', RoomRecordingPolicy::SKIP_REASON_E2EE);

        $this->assertDatabaseHas('audio_rooms', ['id' => $room->id, 'e2ee' => true, 'is_recorded' => false]);
    }

    public function test_live_stream_records_the_e2ee_flag(): void
    {
        $res = $this->actingAs($this->host)->postJson('/api/v1/live/start', [
            'title' => 'Encrypted broadcast',
            'stream_mode' => 'video',
            'e2ee' => true,
        ]);

        $res->assertStatus(201)->assertJsonPath('data.stream.e2ee', true);
        $this->assertDatabaseHas('live_streams', ['title' => 'Encrypted broadcast', 'e2ee' => true]);
    }
}
