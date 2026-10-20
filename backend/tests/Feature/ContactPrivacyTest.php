<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Users reach each other by name or username only. A phone number or email
 * must never be searchable, and must never appear in another user's response.
 */
class ContactPrivacyTest extends TestCase
{
    use RefreshDatabase;

    private function viewer(): User
    {
        return User::factory()->create(['role' => 'member']);
    }

    public function test_search_does_not_match_on_phone_number(): void
    {
        $viewer = $this->viewer();
        $target = User::factory()->create([
            'role' => 'member',
            'name' => 'Ada Lovelace',
            'username' => 'ada_l',
            'mobile_number' => '+2348012345678',
            'email' => 'ada@example.test',
        ]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/friends/search?q=08012345678')
            ->assertOk();

        $ids = collect($response->json('data.data') ?? $response->json('data'))->pluck('id');
        $this->assertFalse($ids->contains($target->id), 'Searching by phone must not find the account.');
    }

    public function test_search_does_not_match_on_email(): void
    {
        $viewer = $this->viewer();
        $target = User::factory()->create(['role' => 'member', 'name' => 'Grace Hopper', 'username' => 'grace_h', 'email' => 'secret.grace@example.test']);

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/friends/search?q=secret.grace')
            ->assertOk();

        $ids = collect($response->json('data.data') ?? $response->json('data'))->pluck('id');
        $this->assertFalse($ids->contains($target->id));
    }

    public function test_search_results_never_carry_phone_or_email(): void
    {
        $viewer = $this->viewer();
        User::factory()->create([
            'role' => 'member',
            'name' => 'Linus Torvalds',
            'username' => 'linus_t',
            'mobile_number' => '+2348099999999',
            'email' => 'linus@example.test',
        ]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/friends/search?q=linus')
            ->assertOk();

        $row = collect($response->json('data.data') ?? $response->json('data'))->firstWhere('username', 'linus_t');
        $this->assertNotNull($row, 'The account should be found by name or username.');
        $this->assertArrayNotHasKey('phone', $row);
        $this->assertArrayNotHasKey('mobile_number', $row);
        $this->assertArrayNotHasKey('email', $row);
    }

    public function test_public_profile_never_exposes_phone_or_email(): void
    {
        $viewer = $this->viewer();
        $target = User::factory()->create([
            'role' => 'member',
            'username' => 'public_p',
            'mobile_number' => '+2348011112222',
            'email' => 'public@example.test',
        ]);

        $body = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/users/'.$target->id)
            ->assertOk()
            ->json();

        $json = json_encode($body);
        $this->assertStringNotContainsString('+2348011112222', $json);
        $this->assertStringNotContainsString('public@example.test', $json);
    }

    public function test_the_account_holder_still_sees_their_own_contact_details(): void
    {
        $user = User::factory()->create([
            'role' => 'member',
            'mobile_number' => '+2348022223333',
            'email' => 'me@example.test',
        ]);

        $body = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/profile')
            ->assertOk()
            ->json();

        $json = json_encode($body);
        $this->assertStringContainsString('+2348022223333', $json);
        $this->assertStringContainsString('me@example.test', $json);
    }
}
