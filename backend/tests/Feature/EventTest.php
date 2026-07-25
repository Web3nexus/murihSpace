<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EventTest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsCreator(): User
    {
        $user = User::factory()->create([
            'role' => 'creator',
            'email_verified_at' => now(),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    protected function actingAsMember(): User
    {
        $user = User::factory()->create([
            'role' => 'member',
            'email_verified_at' => now(),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    protected function actingAsAdmin(): User
    {
        $user = User::factory()->create([
            'role' => 'admin',
            'email_verified_at' => now(),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_public_can_list_upcoming_events(): void
    {
        Event::factory()->count(3)->create();
        Event::factory()->draft()->create();

        $response = $this->getJson('/api/v1/events');

        $response->assertOk();
        $response->assertJsonCount(3, 'data.data');
    }

    public function test_public_can_view_single_event(): void
    {
        $event = Event::factory()->create();

        $response = $this->getJson("/api/v1/events/{$event->id}");

        $response->assertOk();
        $response->assertJsonPath('data.data.title', $event->title);
        $response->assertJsonPath('data.data.is_registration_open', true);
    }

    public function test_creator_can_create_event(): void
    {
        $user = $this->actingAsCreator();
        $community = Community::factory()->create(['user_id' => $user->id]);

        $response = $this->postJson('/api/v1/my-events', [
            'community_id' => $community->id,
            'title' => 'Test Event',
            'description' => 'Event description',
            'event_type' => 'online',
            'start_date' => now()->addDays(7)->format('Y-m-d\TH:i:s'),
            'end_date' => now()->addDays(7)->addHours(3)->format('Y-m-d\TH:i:s'),
            'timezone' => 'UTC',
            'capacity' => 50,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.data.title', 'Test Event');
        $this->assertDatabaseHas('events', ['title' => 'Test Event']);
    }

    public function test_member_cannot_create_event(): void
    {
        $this->actingAsMember();
        $community = Community::factory()->create();

        $response = $this->postJson('/api/v1/my-events', [
            'community_id' => $community->id,
            'title' => 'Test Event',
            'event_type' => 'online',
            'start_date' => now()->addDays(7)->format('Y-m-d\TH:i:s'),
            'end_date' => now()->addDays(7)->addHours(3)->format('Y-m-d\TH:i:s'),
        ]);

        $response->assertForbidden();
    }

    public function test_creator_can_update_own_event(): void
    {
        $user = $this->actingAsCreator();
        $event = Event::factory()->create(['creator_id' => $user->id]);

        $response = $this->putJson("/api/v1/my-events/{$event->id}", [
            'title' => 'Updated Title',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('events', ['id' => $event->id, 'title' => 'Updated Title']);
    }

    public function test_creator_can_list_own_events(): void
    {
        $user = $this->actingAsCreator();
        Event::factory()->count(2)->create(['creator_id' => $user->id]);
        Event::factory()->create();

        $response = $this->getJson('/api/v1/my-events');

        $response->assertOk();
        $response->assertJsonCount(2, 'data.data');
    }

    public function test_creator_cannot_update_others_event(): void
    {
        $this->actingAsCreator();
        $other = User::factory()->create(['role' => 'creator']);
        $event = Event::factory()->create(['creator_id' => $other->id]);

        $response = $this->putJson("/api/v1/my-events/{$event->id}", [
            'title' => 'Hacked Title',
        ]);

        $response->assertForbidden();
    }

    public function test_creator_can_publish_event(): void
    {
        $user = $this->actingAsCreator();
        $event = Event::factory()->draft()->create(['creator_id' => $user->id]);

        $response = $this->postJson("/api/v1/my-events/{$event->id}/publish", [
            'status' => 'published',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('events', ['id' => $event->id, 'status' => 'published']);
    }

    public function test_member_can_list_registered_events(): void
    {
        $user = $this->actingAsMember();
        $event = Event::factory()->create();
        $event->registrations()->create([
            'user_id' => $user->id,
            'status' => 'registered',
            'registered_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/my-registrations');

        $response->assertOk();
        $response->assertJsonCount(1, 'data.data');
    }

    public function test_user_can_register_for_event(): void
    {
        $user = $this->actingAsMember();
        $event = Event::factory()->create();

        $response = $this->postJson("/api/v1/events/{$event->id}/register");

        $response->assertCreated();
        $this->assertDatabaseHas('event_registrations', [
            'event_id' => $event->id,
            'user_id' => $user->id,
            'status' => 'registered',
        ]);
    }

    public function test_user_cannot_register_twice(): void
    {
        $user = $this->actingAsMember();
        $event = Event::factory()->create();

        $this->postJson("/api/v1/events/{$event->id}/register");
        $response = $this->postJson("/api/v1/events/{$event->id}/register");

        $response->assertStatus(422);
    }

    public function test_user_cannot_register_for_full_event(): void
    {
        $user = $this->actingAsMember();
        $event = Event::factory()->create(['capacity' => 0]);
        $event->capacity = 1;
        $event->save();

        $other = User::factory()->create();
        $event->registrations()->create([
            'user_id' => $other->id,
            'status' => 'registered',
            'registered_at' => now(),
        ]);

        $response = $this->postJson("/api/v1/events/{$event->id}/register");
        $response->assertStatus(422);
    }

    public function test_user_can_cancel_registration(): void
    {
        $user = $this->actingAsMember();
        $event = Event::factory()->create();

        $this->postJson("/api/v1/events/{$event->id}/register");
        $response = $this->postJson("/api/v1/events/{$event->id}/cancel");

        $response->assertOk();
        $this->assertDatabaseHas('event_registrations', [
            'event_id' => $event->id,
            'user_id' => $user->id,
            'status' => 'cancelled',
        ]);
    }

    public function test_creator_can_check_in_attendee(): void
    {
        $user = $this->actingAsCreator();
        $event = Event::factory()->create(['creator_id' => $user->id]);
        $attendee = User::factory()->create();

        $event->registrations()->create([
            'user_id' => $attendee->id,
            'status' => 'registered',
            'registered_at' => now(),
        ]);

        $response = $this->postJson("/api/v1/events/{$event->id}/check-in", [
            'user_id' => $attendee->id,
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('event_registrations', [
            'event_id' => $event->id,
            'user_id' => $attendee->id,
            'status' => 'attended',
        ]);
    }

    public function test_creator_can_view_registrations(): void
    {
        $user = $this->actingAsCreator();
        $event = Event::factory()->create(['creator_id' => $user->id]);

        $attendee = User::factory()->create();
        $event->registrations()->create([
            'user_id' => $attendee->id,
            'status' => 'registered',
            'registered_at' => now(),
        ]);

        $response = $this->getJson("/api/v1/events/{$event->id}/registrations");

        $response->assertOk();
        $response->assertJsonCount(1, 'data.data');
    }

    public function test_non_creator_cannot_view_registrations(): void
    {
        $this->actingAsMember();
        $event = Event::factory()->create();

        $response = $this->getJson("/api/v1/events/{$event->id}/registrations");
        $response->assertForbidden();
    }

    public function test_creator_can_delete_own_event(): void
    {
        $user = $this->actingAsCreator();
        $event = Event::factory()->create(['creator_id' => $user->id]);

        $response = $this->deleteJson("/api/v1/my-events/{$event->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('events', ['id' => $event->id]);
    }

    public function test_admin_can_list_all_events(): void
    {
        $this->actingAsAdmin();
        Event::factory()->count(3)->create();

        $response = $this->getJson('/api/v1/securegate/events');

        $response->assertOk();
        $response->assertJsonCount(3, 'data.data');
    }

    public function test_non_admin_cannot_list_all_events(): void
    {
        $this->actingAsMember();
        Event::factory()->count(3)->create();

        $response = $this->getJson('/api/v1/securegate/events');
        $response->assertForbidden();
    }

    public function test_event_registration_deadline_enforced(): void
    {
        $user = $this->actingAsMember();
        $event = Event::factory()->create([
            'registration_deadline' => now()->subDay(),
        ]);

        $response = $this->postJson("/api/v1/events/{$event->id}/register");
        $response->assertStatus(422);
    }

    public function test_cancelled_event_blocks_registration(): void
    {
        $user = $this->actingAsMember();
        $event = Event::factory()->create(['status' => 'cancelled']);

        $response = $this->postJson("/api/v1/events/{$event->id}/register");
        $response->assertStatus(404);
    }
}
