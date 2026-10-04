<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\Event;
use App\Models\LiveStream;
use App\Models\Meeting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Shared MurihSpace links must render as an actionable card ("Join Meeting",
 * "Join Live", "View Event") instead of bare text, and a stale link must say so
 * rather than sending the user into a dead room.
 */
class LinkPreviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_active_meeting_link_resolves_to_a_join_card(): void
    {
        $host = User::factory()->create(['name' => 'Host Person', 'username' => 'hostperson']);

        Meeting::create([
            'code' => 'abc-defg-hij',
            'host_user_id' => $host->id,
            'room' => 'meeting-abc-defg-hij',
            'title' => 'Weekly Standup',
            'expires_at' => now()->addHour(),
        ]);

        $this->getJson('/api/v1/link-preview?url='.urlencode('https://murihspace.com/app/meeting/abc-defg-hij'))
            ->assertStatus(200)
            ->assertJsonPath('data.type', 'meeting')
            ->assertJsonPath('data.code', 'abc-defg-hij')
            ->assertJsonPath('data.title', 'Weekly Standup')
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.label', 'Join Meeting')
            ->assertJsonPath('data.host.name', 'Host Person');
    }

    public function test_a_finished_meeting_link_is_marked_unavailable(): void
    {
        $host = User::factory()->create();

        Meeting::create([
            'code' => 'old-defg-hij',
            'host_user_id' => $host->id,
            'room' => 'meeting-old-defg-hij',
            'title' => 'Last Week Sync',
            'expires_at' => now()->subMinute(),
        ]);

        $this->getJson('/api/v1/link-preview?url='.urlencode('https://murihspace.com/app/meeting/old-defg-hij'))
            ->assertStatus(200)
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.label', 'Meeting Unavailable');
    }

    public function test_a_live_link_resolves_with_the_broadcast_details(): void
    {
        $host = User::factory()->create(['name' => 'Stream Host']);

        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Friday Live Set',
            'status' => 'live',
            'stream_mode' => 'video',
            'livekit_room' => 'room_link_preview',
            'started_at' => now(),
        ]);

        $this->getJson('/api/v1/link-preview?url='.urlencode("https://murihspace.com/live/{$stream->tracking_id}"))
            ->assertStatus(200)
            ->assertJsonPath('data.type', 'live')
            ->assertJsonPath('data.title', 'Friday Live Set')
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.label', 'Join Live');
    }

    public function test_an_event_link_resolves(): void
    {
        Event::create([
            'community_id' => Community::factory()->create()->id,
            'creator_id' => User::factory()->create()->id,
            'title' => 'Community Cleanup Day',
            'slug' => 'community-cleanup-day',
            'event_type' => 'in_person',
            'status' => 'published',
            'start_date' => now()->addWeek(),
            'end_date' => now()->addWeek()->addHours(4),
        ]);

        $this->getJson('/api/v1/link-preview?url='.urlencode('https://murihspace.com/app/events/community-cleanup-day'))
            ->assertStatus(200)
            ->assertJsonPath('data.type', 'event')
            ->assertJsonPath('data.title', 'Community Cleanup Day')
            ->assertJsonPath('data.label', 'View Event');
    }

    public function test_a_non_murihspace_link_is_reported_as_unknown(): void
    {
        $this->getJson('/api/v1/link-preview?url='.urlencode('https://example.com/some/page'))
            ->assertStatus(404)
            ->assertJsonPath('success', false);
    }

    public function test_plain_text_is_not_treated_as_a_link(): void
    {
        $this->getJson('/api/v1/link-preview?url='.urlencode('just a normal message'))
            ->assertStatus(404);
    }

    public function test_previews_are_available_to_guests(): void
    {
        // No actingAs(): a link pasted into a public chat must still preview.
        $this->getJson('/api/v1/link-preview?url='.urlencode('murihspace://live/some-token'))
            ->assertStatus(200)
            ->assertJsonPath('data.type', 'live')
            ->assertJsonPath('data.is_active', false);
    }

    public function test_batch_resolves_only_the_recognised_links(): void
    {
        $host = User::factory()->create();

        Meeting::create([
            'code' => 'aaa-bbbb-ccc',
            'host_user_id' => $host->id,
            'room' => 'meeting-aaa-bbbb-ccc',
            'title' => 'Sync',
            'expires_at' => now()->addHour(),
        ]);

        $response = $this->postJson('/api/v1/link-preview/batch', [
            'urls' => [
                'https://murihspace.com/app/meeting/aaa-bbbb-ccc',
                'https://example.com/not-ours',
            ],
        ]);

        $response->assertStatus(200);

        // Only the recognised link comes back, keyed by the original string.
        $previews = $response->json('data');
        $this->assertCount(1, $previews);
        $this->assertSame(
            'meeting',
            $previews['https://murihspace.com/app/meeting/aaa-bbbb-ccc']['type'],
        );
    }
}