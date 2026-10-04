<?php

namespace Tests\Feature;

use App\Models\LiveStream;
use App\Models\LiveStreamParticipant;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;
use Illuminate\Broadcasting\Broadcasters\Broadcaster;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use ReflectionMethod;
use ReflectionProperty;
use Tests\TestCase;

/**
 * Presence channels are private because they carry the roster, which would
 * otherwise enumerate everybody watching a stream. Subscribing must therefore
 * require being in the room, and never merely holding a valid session.
 *
 * The callbacks in `routes/channels.php` are asserted directly rather than
 * through `/broadcasting/auth`, because the test suite runs on the `null`
 * broadcaster, whose `auth()` is a deliberate no-op and would authorise
 * everything.
 */
class SessionPresenceChannelAuthTest extends TestCase
{
    use RefreshDatabase;

    private User $host;

    private User $member;

    private User $stranger;

    private Meeting $meeting;

    protected function setUp(): void
    {
        parent::setUp();

        $this->host = User::factory()->create(['role' => 'creator']);
        $this->member = User::factory()->create(['role' => 'member']);
        $this->stranger = User::factory()->create(['role' => 'member']);

        $this->meeting = Meeting::create([
            'code' => 'chan-test-01',
            'host_user_id' => $this->host->id,
            'room' => 'meeting-chan-test-01',
            'title' => 'Channel Test',
            'expires_at' => now()->addHour(),
        ]);
    }

    public function test_attendee_can_subscribe_to_the_meeting_presence_channel(): void
    {
        $this->addMeetingParticipant($this->member);

        $this->assertTrue($this->mayJoinChannel($this->member, 'private-meeting.chan-test-01'));
    }

    public function test_meeting_host_may_subscribe_without_an_explicit_roster_row(): void
    {
        $this->assertTrue($this->mayJoinChannel($this->host, 'private-meeting.chan-test-01'));
    }

    public function test_somebody_outside_the_meeting_cannot_subscribe_to_its_channel(): void
    {
        $this->assertFalse($this->mayJoinChannel($this->stranger, 'private-meeting.chan-test-01'));
    }

    public function test_a_participant_who_already_left_loses_channel_access(): void
    {
        MeetingParticipant::create([
            'meeting_id' => $this->meeting->id,
            'user_id' => $this->member->id,
            'role' => MeetingParticipant::ROLE_PARTICIPANT,
            'is_active' => false,
            'joined_at' => now()->subHour(),
            'left_at' => now(),
        ]);

        $this->assertFalse($this->mayJoinChannel($this->member, 'private-meeting.chan-test-01'));
    }

    public function test_unknown_meeting_code_has_no_channel(): void
    {
        $this->assertFalse($this->mayJoinChannel($this->host, 'private-meeting.does-not-exist'));
    }

    public function test_viewer_can_subscribe_to_the_live_room_channel_only_after_joining(): void
    {
        $stream = $this->liveStream();

        $this->assertFalse($this->mayJoinChannel($this->member, "private-live-room.{$stream->id}"));

        LiveStreamParticipant::create([
            'live_stream_id' => $stream->id,
            'user_id' => $this->member->id,
            'role' => LiveStreamParticipant::ROLE_VIEWER,
            'is_active' => true,
            'joined_at' => now(),
        ]);

        $this->assertTrue($this->mayJoinChannel($this->member, "private-live-room.{$stream->id}"));
    }

    public function test_broadcast_host_always_has_live_room_channel_access(): void
    {
        $stream = $this->liveStream();

        $this->assertTrue($this->mayJoinChannel($this->host, "private-live-room.{$stream->id}"));
    }

    public function test_unknown_live_stream_has_no_channel(): void
    {
        $this->assertFalse($this->mayJoinChannel($this->host, 'private-live-room.999999'));
    }

    /**
     * Invoke the registered `routes/channels.php` callback for a channel and
     * return whether it authorises the user.
     */
    private function mayJoinChannel(User $user, string $channel): bool
    {
        $broadcaster = Broadcast::driver();

        $channels = (new ReflectionProperty(Broadcaster::class, 'channels'))
            ->getValue($broadcaster);

        // The framework strips the presence prefix before matching a channel
        // name against its registered patterns.
        $normalized = preg_replace('/^(private|presence)-/', '', $channel);

        $extract = new ReflectionMethod(Broadcaster::class, 'extractAuthParameters');
        $matches = new ReflectionMethod(Broadcaster::class, 'channelNameMatchesPattern');

        foreach ($channels as $pattern => $callback) {
            if (! $matches->invoke($broadcaster, $normalized, $pattern)) {
                continue;
            }

            $parameters = $extract->invoke($broadcaster, $pattern, $normalized, $callback);

            return (bool) $callback($user, ...$parameters);
        }

        $this->fail("No channel callback registered for [{$channel}].");
    }

    private function addMeetingParticipant(User $user): void
    {
        MeetingParticipant::create([
            'meeting_id' => $this->meeting->id,
            'user_id' => $user->id,
            'role' => MeetingParticipant::ROLE_PARTICIPANT,
            'is_active' => true,
            'joined_at' => now(),
        ]);
    }

    private function liveStream(): LiveStream
    {
        return LiveStream::create([
            'user_id' => $this->host->id,
            'title' => 'Channel Live',
            'stream_mode' => 'video',
            'status' => 'live',
            'livekit_room' => 'room_channel_live',
            'started_at' => now(),
        ]);
    }
}