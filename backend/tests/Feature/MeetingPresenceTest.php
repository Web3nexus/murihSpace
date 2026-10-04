<?php

namespace Tests\Feature;

use App\Events\MeetingEnded;
use App\Exceptions\RemovedFromSessionException;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Server-authoritative meeting presence and host moderation.
 *
 * The bug this locks down: a session used to be treated as over as soon as a
 * browser navigated away, so participants vanished from the roster and a host
 * lost control of the room the moment they opened another tab.
 */
class MeetingPresenceTest extends TestCase
{
    use RefreshDatabase;

    private User $host;

    private User $member;

    private Meeting $meeting;

    protected function setUp(): void
    {
        parent::setUp();

        $this->host = User::factory()->create(['name' => 'Host User', 'username' => 'hostuser', 'role' => 'creator']);
        $this->member = User::factory()->create(['name' => 'Attendee', 'username' => 'attendee', 'role' => 'member']);

        $this->meeting = Meeting::create([
            'code' => 'aaa-bbbb-ccc',
            'host_user_id' => $this->host->id,
            'room' => 'meeting-aaa-bbbb-ccc',
            'title' => 'Design Sync',
            'expires_at' => now()->addHours(8),
        ]);

        Config::set('livekit.host', 'https://livekit.test.murihspace.com');
        Config::set('livekit.api_key', 'LK_TEST_KEY');
        Config::set('livekit.api_secret', str_repeat('s', 40));

        // Never let a moderation test reach a real media server.
        Http::fake([
            'livekit.test.murihspace.com/*' => Http::response(['participants' => [], 'identity' => 'x']),
        ]);
    }

    public function test_joining_registers_presence_and_returns_the_current_roster(): void
    {
        Sanctum::actingAs($this->host);
        $this->getJson('/api/v1/meetings/aaa-bbbb-ccc/token')->assertStatus(200);

        Sanctum::actingAs($this->member);
        $response = $this->getJson('/api/v1/meetings/aaa-bbbb-ccc/token');

        $response->assertStatus(200);

        // The joiner is handed the whole roster, which is what makes an existing
        // attendee and a late joiner agree on who is present.
        $userIds = collect($response->json('data.participants'))->pluck('user_id')->all();
        $this->assertEqualsCanonicalizing([$this->host->id, $this->member->id], $userIds);

        $this->assertDatabaseHas('meeting_participants', [
            'meeting_id' => $this->meeting->id,
            'user_id' => $this->member->id,
            'is_active' => true,
            'role' => MeetingParticipant::ROLE_PARTICIPANT,
        ]);
    }

    public function test_rejoining_does_not_duplicate_the_roster_row(): void
    {
        Sanctum::actingAs($this->member);

        $this->getJson('/api/v1/meetings/aaa-bbbb-ccc/token')->assertStatus(200);
        $this->getJson('/api/v1/meetings/aaa-bbbb-ccc/token')->assertStatus(200);

        $this->assertSame(1, MeetingParticipant::where('user_id', $this->member->id)->count());
    }

    public function test_reconnect_keeps_the_role_promoted_by_the_host(): void
    {
        $this->joinMember();

        MeetingParticipant::where('user_id', $this->member->id)
            ->update(['role' => MeetingParticipant::ROLE_MODERATOR]);

        // A reconnect must not silently demote somebody the host promoted.
        $this->getJson('/api/v1/meetings/aaa-bbbb-ccc/token')->assertStatus(200);

        $this->assertSame(
            MeetingParticipant::ROLE_MODERATOR,
            MeetingParticipant::where('user_id', $this->member->id)->value('role')
        );
    }

    public function test_explicit_leave_marks_the_participant_gone_and_is_idempotent(): void
    {
        $this->joinMember();

        $this->postJson('/api/v1/meetings/aaa-bbbb-ccc/leave')->assertStatus(200);

        $this->assertDatabaseHas('meeting_participants', [
            'meeting_id' => $this->meeting->id,
            'user_id' => $this->member->id,
            'is_active' => false,
        ]);

        // Leaving twice (or after the room is gone) must not error.
        $this->postJson('/api/v1/meetings/aaa-bbbb-ccc/leave')->assertStatus(200);
    }

    public function test_state_endpoint_records_mic_and_camera_for_other_clients(): void
    {
        $this->joinMember();

        $response = $this->postJson('/api/v1/meetings/aaa-bbbb-ccc/state', [
            'is_muted' => true,
            'is_camera_on' => true,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.participant.is_muted', true)
            ->assertJsonPath('data.participant.is_camera_on', true);
    }

    public function test_attendee_cannot_mute_another_participant(): void
    {
        $this->joinMember();

        $this->postJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$this->host->id}/mute")
            ->assertStatus(403);
    }

    public function test_attendee_cannot_change_roles_or_remove_participants(): void
    {
        $this->joinMember();

        $this->postJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$this->host->id}/role", [
            'role' => MeetingParticipant::ROLE_MODERATOR,
        ])->assertStatus(403);

        $this->deleteJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$this->host->id}")
            ->assertStatus(403);

        $this->postJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$this->host->id}/restrict", [
            'restricted' => true,
        ])->assertStatus(403);
    }

    public function test_host_can_mute_a_participant(): void
    {
        $this->joinMember();

        $this->actingAs($this->host)
            ->postJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$this->member->id}/mute")
            ->assertStatus(200);

        $this->assertDatabaseHas('meeting_participants', [
            'user_id' => $this->member->id,
            'is_muted' => true,
        ]);
    }

    public function test_host_can_promote_a_participant_to_moderator(): void
    {
        $this->joinMember();

        $this->actingAs($this->host)
            ->postJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$this->member->id}/role", [
                'role' => MeetingParticipant::ROLE_MODERATOR,
            ])
            ->assertStatus(200);

        $this->assertSame(
            MeetingParticipant::ROLE_MODERATOR,
            MeetingParticipant::where('user_id', $this->member->id)->value('role')
        );
    }

    public function test_a_promoted_moderator_can_then_mute_somebody(): void
    {
        $this->joinMember();
        $other = User::factory()->create(['role' => 'member']);

        Sanctum::actingAs($other);
        $this->getJson('/api/v1/meetings/aaa-bbbb-ccc/token')->assertStatus(200);

        $this->actingAs($this->host)
            ->postJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$this->member->id}/role", [
                'role' => MeetingParticipant::ROLE_MODERATOR,
            ])->assertStatus(200);

        $this->actingAs($this->member)
            ->postJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$other->id}/mute")
            ->assertStatus(200);
    }

    public function test_host_cannot_be_removed_or_have_their_role_changed(): void
    {
        $this->joinMember();

        $this->actingAs($this->host)
            ->deleteJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$this->host->id}")
            ->assertStatus(403);

        $this->actingAs($this->host)
            ->postJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$this->host->id}/role", [
                'role' => MeetingParticipant::ROLE_PARTICIPANT,
            ])->assertStatus(403);
    }

    public function test_only_the_host_can_end_the_meeting(): void
    {
        $this->joinMember();

        $this->postJson('/api/v1/meetings/aaa-bbbb-ccc/end')->assertStatus(403);

        Event::fake([MeetingEnded::class]);
        $this->actingAs($this->host)
            ->postJson('/api/v1/meetings/aaa-bbbb-ccc/end')
            ->assertStatus(200);

        Event::assertDispatched(MeetingEnded::class);
    }

    public function test_ending_a_meeting_expires_it_and_blocks_new_joins(): void
    {
        $this->joinMember();

        $this->actingAs($this->host)->postJson('/api/v1/meetings/aaa-bbbb-ccc/end')->assertStatus(200);

        // The room is genuinely over: new tokens are refused, unlike the old
        // behaviour where anyone could mint a token for any code.
        $this->getJson('/api/v1/meetings/aaa-bbbb-ccc/token')->assertStatus(404);

        $this->assertDatabaseHas('meeting_participants', [
            'user_id' => $this->member->id,
            'is_active' => false,
        ]);
    }

    public function test_meeting_metadata_is_available_for_link_previews(): void
    {
        $this->actingAs($this->member)
            ->getJson('/api/v1/meetings/aaa-bbbb-ccc')
            ->assertStatus(200)
            ->assertJsonPath('data.type', 'meeting')
            ->assertJsonPath('data.code', 'aaa-bbbb-ccc')
            ->assertJsonPath('data.title', 'Design Sync');
    }

    public function test_a_removed_participant_cannot_rejoin(): void
    {
        $this->joinMember();

        $this->actingAs($this->host)
            ->deleteJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$this->member->id}")
            ->assertStatus(200);

        $this->assertNotNull(
            MeetingParticipant::query()
                ->where('meeting_id', $this->meeting->id)
                ->where('user_id', $this->member->id)
                ->first()?->removed_at,
            'Removing a participant must stamp the row so join() can refuse it.'
        );

        // The stamp is what makes the removal stick. Before it, this same
        // request reactivated the row and the kick lasted one round trip.
        $this->actingAs($this->member)
            ->postJson('/api/v1/meetings/aaa-bbbb-ccc/join')
            ->assertStatus(403)
            ->assertJsonPath('code', RemovedFromSessionException::CODE);

        $this->assertDatabaseHas('meeting_participants', [
            'meeting_id' => $this->meeting->id,
            'user_id' => $this->member->id,
            'is_active' => false,
        ]);
    }

    public function test_a_removed_participant_cannot_slip_back_in_via_the_token_endpoint(): void
    {
        $this->joinMember();

        $this->actingAs($this->host)
            ->deleteJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$this->member->id}")
            ->assertStatus(200);

        // Token minting also joins presence, so it is a second door into the
        // same room and has to honour the removal.
        $this->actingAs($this->member)
            ->getJson('/api/v1/meetings/aaa-bbbb-ccc/token')
            ->assertStatus(403);
    }

    public function test_a_voluntary_leave_does_not_block_rejoining(): void
    {
        $this->joinMember();

        $this->actingAs($this->member)
            ->postJson('/api/v1/meetings/aaa-bbbb-ccc/leave')
            ->assertStatus(200);

        // Only a moderator's removal is sticky. Leaving and coming back is a
        // normal reconnect and must keep working.
        $this->actingAs($this->member)
            ->postJson('/api/v1/meetings/aaa-bbbb-ccc/join')
            ->assertStatus(200);

        $this->assertDatabaseHas('meeting_participants', [
            'meeting_id' => $this->meeting->id,
            'user_id' => $this->member->id,
            'is_active' => true,
            'removed_at' => null,
        ]);
    }

    public function test_the_participants_endpoint_does_not_join(): void
    {
        // A plain GET used to register presence, which meant it could also
        // resurrect somebody the host had just removed.
        $this->actingAs($this->member)
            ->getJson('/api/v1/meetings/aaa-bbbb-ccc/participants')
            ->assertStatus(200)
            ->assertJsonPath('data.participants', []);

        $this->assertDatabaseMissing('meeting_participants', [
            'meeting_id' => $this->meeting->id,
            'user_id' => $this->member->id,
        ]);
    }

    public function test_the_join_endpoint_registers_presence(): void
    {
        $this->actingAs($this->member)
            ->postJson('/api/v1/meetings/aaa-bbbb-ccc/join')
            ->assertStatus(200);

        $this->assertDatabaseHas('meeting_participants', [
            'meeting_id' => $this->meeting->id,
            'user_id' => $this->member->id,
            'is_active' => true,
            'removed_at' => null,
        ]);
    }

    public function test_state_updates_are_refused_for_non_participants(): void
    {
        // updateState() used to upsert, so posting a mute flag was a way to
        // add yourself to a room you had been removed from.
        $this->actingAs($this->member)
            ->postJson('/api/v1/meetings/aaa-bbbb-ccc/state', ['is_muted' => true])
            ->assertStatus(409);

        $this->assertDatabaseMissing('meeting_participants', [
            'meeting_id' => $this->meeting->id,
            'user_id' => $this->member->id,
        ]);
    }

    public function test_state_updates_are_refused_after_removal(): void
    {
        $this->joinMember();

        $this->actingAs($this->host)
            ->deleteJson("/api/v1/meetings/aaa-bbbb-ccc/participants/{$this->member->id}")
            ->assertStatus(200);

        $this->actingAs($this->member)
            ->postJson('/api/v1/meetings/aaa-bbbb-ccc/state', ['is_muted' => true])
            ->assertStatus(409);
    }

    private function joinMember(): void
    {
        Sanctum::actingAs($this->member);
        $this->getJson('/api/v1/meetings/aaa-bbbb-ccc/token')->assertStatus(200);
    }
}