<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserLocation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserLocationTest extends TestCase
{
    use RefreshDatabase;

    public function test_location_is_off_by_default(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/auth/location')
            ->assertOk()
            ->assertJsonPath('data.sharing_enabled', false)
            ->assertJsonPath('data.has_location', false);
    }

    public function test_position_is_refused_until_sharing_is_turned_on(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/location', ['latitude' => 6.52, 'longitude' => 3.37])
            ->assertStatus(403);

        $this->assertDatabaseMissing('user_locations', ['user_id' => $user->id, 'latitude' => 6.52]);
    }

    public function test_position_is_rounded_to_about_one_kilometre(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/v1/auth/location/sharing', ['enabled' => true])
            ->assertOk()
            ->assertJsonPath('data.sharing_enabled', true);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/location', ['latitude' => 6.52341, 'longitude' => 3.37892])
            ->assertOk()
            ->assertJsonPath('data.has_location', true);

        $location = UserLocation::firstWhere('user_id', $user->id);
        $this->assertSame(6.52, $location->latitude);
        $this->assertSame(3.38, $location->longitude);
    }

    public function test_turning_sharing_off_clears_the_stored_position(): void
    {
        $user = User::factory()->create();
        UserLocation::create([
            'user_id' => $user->id,
            'sharing_enabled' => true,
            'latitude' => 6.52,
            'longitude' => 3.38,
            'captured_at' => now(),
        ]);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/v1/auth/location/sharing', ['enabled' => false])
            ->assertOk()
            ->assertJsonPath('data.sharing_enabled', false)
            ->assertJsonPath('data.has_location', false);

        $location = UserLocation::firstWhere('user_id', $user->id);
        $this->assertFalse($location->sharing_enabled);
        $this->assertNull($location->latitude);
        $this->assertNull($location->longitude);
    }

    public function test_delete_removes_the_location_record(): void
    {
        $user = User::factory()->create();
        UserLocation::create([
            'user_id' => $user->id,
            'sharing_enabled' => true,
            'latitude' => 6.52,
            'longitude' => 3.38,
        ]);

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/v1/auth/location')
            ->assertOk()
            ->assertJsonPath('data.sharing_enabled', false);

        $this->assertDatabaseMissing('user_locations', ['user_id' => $user->id]);
    }

    public function test_distance_helper_matches_a_known_pair(): void
    {
        // Lagos to Abuja is about 526 km by great circle.
        $km = UserLocation::distanceKm(6.52, 3.38, 9.08, 7.40);

        $this->assertEqualsWithDelta(526, $km, 5);
    }

    public function test_nearby_users_are_labelled_and_listed_first(): void
    {
        $viewer = User::factory()->create(['role' => 'member']);
        $nearby = User::factory()->create(['role' => 'member']);
        $far = User::factory()->create(['role' => 'member']);

        UserLocation::create(['user_id' => $viewer->id, 'sharing_enabled' => true, 'latitude' => 6.52, 'longitude' => 3.38, 'captured_at' => now()]);
        UserLocation::create(['user_id' => $nearby->id, 'sharing_enabled' => true, 'latitude' => 6.53, 'longitude' => 3.39, 'captured_at' => now()]);
        UserLocation::create(['user_id' => $far->id, 'sharing_enabled' => true, 'latitude' => 9.08, 'longitude' => 7.40, 'captured_at' => now()]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/friends/suggestions')
            ->assertOk();

        // The controller returns { data: [...] } inside the standard response envelope.
        $rows = collect($response->json('data.data'));
        $nearRow = $rows->firstWhere('id', $nearby->id);
        $farRow = $rows->firstWhere('id', $far->id);

        $this->assertNotNull($nearRow, 'The nearby member should be suggested.');
        $this->assertSame('Nearby', $nearRow['reason']);
        $this->assertArrayNotHasKey('distance_km', $nearRow, 'Distances must never be returned.');
        if ($farRow !== null) {
            $this->assertNotSame('Nearby', $farRow['reason']);
            $this->assertLessThan(
                $rows->search(fn ($r) => $r['id'] === $farRow['id']),
                $rows->search(fn ($r) => $r['id'] === $nearby->id),
            );
        }
    }
}
