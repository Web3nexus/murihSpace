<?php

namespace Tests\Feature;

use App\Exceptions\RemovedFromSessionException;
use App\Models\LiveStream;
use App\Models\LiveStreamParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Live broadcast moderation is enforced by the API, not by the browser.
 *
 * Each test asserts the viewer is refused even though the route exists and the
 * viewer holds a perfectly valid session.
 */
class LiveStreamModerationTest extends TestCase
{
    use RefreshDatabase;

    private User $host;

    private User $viewer;

    private LiveStream $stream;

    /**
     * Identities the fake media server reports as present in the room.
     *
     * `Http::fake()` appends stubs, so a per-test `Http::fake()` would be
     * shadowed by the one registered in `setUp`. Routing the room contents
     * through this property keeps a single stub for the whole file.
     *
     * @var array<int, string>
     */
    private array $roomIdentities = [];

    /** When true the fake media server refuses every Twirp call. */
    private bool $mediaUnavailable = false;

    protected function setUp(): void
    {
        parent::setUp();

        $this->host = User::factory()->create(['name' => 'Stream Host', 'kyc_status' => 'verified']);
        $this->viewer = User::factory()->create(['name' => 'Viewer']);

        $this->stream = LiveStream::create([
            'user_id' => $this->host->id,
            'title' => 'Community Q&A',
            'stream_mode' => 'video',
            'status' => 'live',
            'livekit_room' => 'room_moderation_test',
            'started_at' => now(),
        ]);

        // `/live/start` registers the host as an active participant, so the
        // fixture mirrors a real broadcast rather than an orphaned stream.
        LiveStreamParticipant::create([
            'live_stream_id' => $this->stream->id,
            'user_id' => $this->host->id,
            'role' => LiveStreamParticipant::ROLE_HOST,
            'is_active' => true,
            'joined_at' => now(),
        ]);

        Config::set('livekit.host', 'https://livekit.test.murihspace.com');
        Config::set('livekit.api_key', 'LK_TEST_KEY');
        Config::set('livekit.api_secret', str_repeat('s', 40));

        Http::fake([
            'livekit.test.murihspace.com/*' => function ($request) {
                if ($this->mediaUnavailable) {
                    return Http::response(['error' => 'unavailable'], 503);
                }

                if (str_contains($request->url(), 'ListParticipants')) {
                    return Http::response([
                        'participants' => array_map(
                            fn (string $identity) => ['identity' => $identity],
                            $this->roomIdentities
                        ),
                    ]);
                }

                return Http::response([], 200);
            },
        ]);
    }

    public function test_joining_registers_presence_and_updates_the_viewer_count(): void
    {
        $this->actingAs($this->viewer)
            ->postJson("/api/v1/live/{$this->stream->id}/join")
            ->assertStatus(200);

        $this->assertDatabaseHas('live_stream_participants', [
            'live_stream_id' => $this->stream->id,
            'user_id' => $this->viewer->id,
            'is_active' => true,
            'role' => LiveStreamParticipant::ROLE_VIEWER,
        ]);

        $this->assertSame(2, $this->stream->fresh()->viewers_count);
    }

    public function test_a_failed_media_restriction_is_reported_instead_of_being_recorded(): void
    {
        LiveStreamParticipant::create([
            'live_stream_id' => $this->stream->id,
            'user_id' => $this->viewer->id,
            'role' => LiveStreamParticipant::ROLE_VIEWER,
            'is_active' => true,
            'joined_at' => now(),
        ]);

        // The media server refuses the permission change.
        $this->mediaUnavailable = true;

        $this->actingAs($this->host)
            ->postJson("/api/v1/live/{$this->stream->id}/participants/{$this->viewer->id}/restrict", [
                'restricted' => true,
            ])
            ->assertStatus(503);

        // Reporting the viewer as restricted while LiveKit kept their publish
        // rights would be a lie the host acts on.
        $this->assertDatabaseHas('live_stream_participants', [
            'live_stream_id' => $this->stream->id,
            'user_id' => $this->viewer->id,
            'is_restricted' => false,
        ]);
    }

    public function test_ending_a_stream_removes_every_viewer_from_the_media_room(): void
    {
        $second = User::factory()->create(['name' => 'Second Viewer']);

        foreach ([$this->viewer, $second] as $fan) {
            LiveStreamParticipant::create([
                'live_stream_id' => $this->stream->id,
                'user_id' => $fan->id,
                'role' => LiveStreamParticipant::ROLE_VIEWER,
                'is_active' => true,
                'joined_at' => now(),
            ]);
        }

        $this->roomIdentities = [
            'user_'.$this->host->id,
            'user_'.$this->viewer->id,
            'user_'.$second->id,
        ];

        $this->actingAs($this->host)
            ->postJson("/api/v1/live/{$this->stream->id}/end")
            ->assertStatus(200);

        // Everyone still connected must be dropped from the media room, not just
        // the host: otherwise viewers keep a live socket to a stream that the
        // database already reports as ended.
        foreach (['user_'.$this->viewer->id, 'user_'.$second->id] as $identity) {
            Http::assertSent(function ($request) use ($identity) {
                return str_contains((string) $request->url(), 'RemoveParticipant')
                    && ($request['identity'] ?? null) === $identity;
            });
        }

        // The roster must be closed out too, not left claiming active viewers.
        $this->assertSame(0, LiveStreamParticipant::where('live_stream_id', $this->stream->id)
            ->where('is_active', true)
            ->count());
        $this->assertSame('ended', $this->stream->fresh()->status);
    }

    public function test_viewer_cannot_read_the_participant_roster(): void
    {
        $this->actingAs($this->viewer)
            ->getJson("/api/v1/live/{$this->stream->id}/participants")
            ->assertStatus(403);
    }

    public function test_viewer_cannot_mute_promote_restrict_or_remove_anybody(): void
    {
        $other = User::factory()->create();

        LiveStreamParticipant::create([
            'live_stream_id' => $this->stream->id,
            'user_id' => $other->id,
            'role' => LiveStreamParticipant::ROLE_VIEWER,
            'is_active' => true,
            'joined_at' => now(),
        ]);

        $url = "/api/v1/live/{$this->stream->id}/participants/{$other->id}";

        $this->actingAs($this->viewer)->postJson("{$url}/mute")->assertStatus(403);
        $this->actingAs($this->viewer)->postJson("{$url}/restrict", ['restricted' => true])->assertStatus(403);
        $this->actingAs($this->viewer)->postJson("{$url}/role", ['role' => 'moderator'])->assertStatus(403);
        $this->actingAs($this->viewer)->deleteJson($url)->assertStatus(403);

        // Nothing changed.
        $this->assertDatabaseHas('live_stream_participants', [
            'user_id' => $other->id,
            'is_active' => true,
            'is_restricted' => false,
            'role' => LiveStreamParticipant::ROLE_VIEWER,
        ]);
    }

    public function test_host_can_read_the_roster(): void
    {
        $this->actingAs($this->host)
            ->getJson("/api/v1/live/{$this->stream->id}/participants")
            ->assertStatus(200)
            ->assertJsonPath('data.can_moderate', true);
    }

    public function test_host_can_promote_a_viewer_to_moderator(): void
    {
        $this->joinViewer();

        $this->actingAs($this->host)
            ->postJson("/api/v1/live/{$this->stream->id}/participants/{$this->viewer->id}/role", [
                'role' => LiveStreamParticipant::ROLE_MODERATOR,
            ])
            ->assertStatus(200);

        $this->assertSame(
            LiveStreamParticipant::ROLE_MODERATOR,
            LiveStreamParticipant::where('user_id', $this->viewer->id)->value('role')
        );
    }

    public function test_a_promoted_moderator_can_read_the_roster(): void
    {
        $this->joinViewer();

        $this->actingAs($this->host)
            ->postJson("/api/v1/live/{$this->stream->id}/participants/{$this->viewer->id}/role", [
                'role' => LiveStreamParticipant::ROLE_MODERATOR,
            ])->assertStatus(200);

        $this->actingAs($this->viewer)
            ->getJson("/api/v1/live/{$this->stream->id}/participants")
            ->assertStatus(200);
    }

    public function test_restriction_is_pushed_to_the_media_server_and_survives_a_rejoin(): void
    {
        $this->joinViewer();

        $this->actingAs($this->host)
            ->postJson("/api/v1/live/{$this->stream->id}/participants/{$this->viewer->id}/restrict", [
                'restricted' => true,
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('live_stream_participants', [
            'user_id' => $this->viewer->id,
            'is_restricted' => true,
        ]);

        Http::assertSent(function (Request $request) {
            return str_contains($request->url(), 'UpdateParticipant')
                && ($request['permission']['canPublish'] ?? null) === false;
        });

        // Rejoining must not hand back a publish-capable token, which would
        // silently undo the host's decision.
        $response = $this->actingAs($this->viewer)
            ->postJson("/api/v1/live/{$this->stream->id}/join")
            ->assertStatus(200);

        $this->assertFalse($response->json('data.livekit.is_publisher'));
    }

    public function test_host_can_remove_a_participant(): void
    {
        $this->joinViewer();

        $this->actingAs($this->host)
            ->deleteJson("/api/v1/live/{$this->stream->id}/participants/{$this->viewer->id}")
            ->assertStatus(200);

        $this->assertDatabaseHas('live_stream_participants', [
            'user_id' => $this->viewer->id,
            'is_active' => false,
        ]);

        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'RemoveParticipant'));
    }

    public function test_host_cannot_be_removed(): void
    {
        $this->actingAs($this->host)
            ->deleteJson("/api/v1/live/{$this->stream->id}/participants/{$this->host->id}")
            ->assertStatus(400);
    }

    public function test_moderating_somebody_who_is_not_in_the_broadcast_returns_404(): void
    {
        $stranger = User::factory()->create();

        $this->actingAs($this->host)
            ->postJson("/api/v1/live/{$this->stream->id}/participants/{$stranger->id}/mute")
            ->assertStatus(404);
    }

    public function test_leaving_drops_the_viewer_from_the_roster_and_the_count(): void
    {
        $this->joinViewer();

        $this->actingAs($this->viewer)
            ->postJson("/api/v1/live/{$this->stream->id}/leave")
            ->assertStatus(200);

        $this->assertSame(1, $this->stream->fresh()->viewers_count);
    }

    public function test_a_removed_viewer_cannot_rejoin(): void
    {
        $this->joinViewer();

        $this->actingAs($this->host)
            ->deleteJson("/api/v1/live/{$this->stream->id}/participants/{$this->viewer->id}")
            ->assertStatus(200);

        $this->assertNotNull(
            LiveStreamParticipant::query()
                ->where('live_stream_id', $this->stream->id)
                ->where('user_id', $this->viewer->id)
                ->first()?->removed_at,
            'Removing a viewer must stamp the row so join() can refuse it.'
        );

        // The removal used to be undone by the viewer's very next request,
        // because join() upserted the same row with is_active = true.
        $this->actingAs($this->viewer)
            ->postJson("/api/v1/live/{$this->stream->id}/join")
            ->assertStatus(403)
            ->assertJsonPath('code', RemovedFromSessionException::CODE);

        $this->assertDatabaseHas('live_stream_participants', [
            'live_stream_id' => $this->stream->id,
            'user_id' => $this->viewer->id,
            'is_active' => false,
        ]);
    }

    public function test_a_viewer_who_leaves_on_their_own_can_rejoin(): void
    {
        $this->joinViewer();

        $this->actingAs($this->viewer)
            ->postJson("/api/v1/live/{$this->stream->id}/leave")
            ->assertStatus(200);

        // Only a moderator's removal is sticky; an ordinary disconnect and
        // return is normal.
        $this->actingAs($this->viewer)
            ->postJson("/api/v1/live/{$this->stream->id}/join")
            ->assertStatus(200);

        $this->assertDatabaseHas('live_stream_participants', [
            'live_stream_id' => $this->stream->id,
            'user_id' => $this->viewer->id,
            'is_active' => true,
            'removed_at' => null,
        ]);
    }

    public function test_an_unrecognised_media_identity_does_not_expire_the_roster(): void
    {
        $this->joinViewer();

        // Somebody else's identity in the room is not evidence that our
        // participants left. A loose digit match also used to read identities
        // like "guest-42" as a real user id and keep the wrong rows alive.
        LiveStreamParticipant::query()
            ->where('live_stream_id', $this->stream->id)
            ->update(['last_seen_at' => now()->subHour()]);

        $this->roomIdentities = ['guest-42', 'server-bot'];

        $this->actingAs($this->host)
            ->getJson("/api/v1/live/{$this->stream->id}/participants")
            ->assertStatus(200);

        $this->assertDatabaseHas('live_stream_participants', [
            'live_stream_id' => $this->stream->id,
            'user_id' => $this->viewer->id,
            'is_active' => true,
        ]);
    }

    public function test_an_empty_media_roster_does_not_expire_the_roster(): void
    {
        $this->joinViewer();

        LiveStreamParticipant::query()
            ->where('live_stream_id', $this->stream->id)
            ->update(['last_seen_at' => now()->subHour()]);

        // The media server reporting zero participants while it restarts is
        // not evidence that the audience left; ageing the roster on that
        // evidence would empty a live room.
        $this->roomIdentities = [];

        $this->actingAs($this->host)
            ->getJson("/api/v1/live/{$this->stream->id}/participants")
            ->assertStatus(200);

        $this->assertDatabaseHas('live_stream_participants', [
            'live_stream_id' => $this->stream->id,
            'user_id' => $this->viewer->id,
            'is_active' => true,
        ]);
    }

    public function test_a_confirmed_presence_refreshes_the_heartbeat(): void
    {
        $this->joinViewer();

        LiveStreamParticipant::query()
            ->where('live_stream_id', $this->stream->id)
            ->update(['last_seen_at' => now()->subHour()]);

        // Connected participants are demonstrably still watching, so the
        // heartbeat must not be allowed to age them into "left".
        $this->roomIdentities = ['user_'.$this->viewer->id];

        $this->actingAs($this->host)
            ->getJson("/api/v1/live/{$this->stream->id}/participants")
            ->assertStatus(200);

        $stale = LiveStreamParticipant::query()
            ->where('live_stream_id', $this->stream->id)
            ->where('user_id', $this->viewer->id)
            ->where('last_seen_at', '<', now()->subMinutes(30))
            ->exists();

        $this->assertFalse($stale, 'A confirmed media identity must refresh last_seen_at.');

        // Also assert they are still on the roster. last_seen_at alone is not
        // enough evidence here: expiring a participant stamps last_seen_at with
        // the current time, so a stale-looking field read as "fresh" after the
        // very expiry this test is guarding against.
        $this->assertDatabaseHas('live_stream_participants', [
            'live_stream_id' => $this->stream->id,
            'user_id' => $this->viewer->id,
            'is_active' => true,
        ]);
    }

    private function joinViewer(): void
    {
        $this->actingAs($this->viewer)
            ->postJson("/api/v1/live/{$this->stream->id}/join")
            ->assertStatus(200);
    }
}