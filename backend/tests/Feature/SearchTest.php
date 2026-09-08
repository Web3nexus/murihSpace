<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_search_users_by_name_and_username(): void
    {
        $alice = User::factory()->create([
            'name'     => 'Alice Wonderland',
            'username' => 'alicew',
            'email'    => 'alice@example.com',
        ]);

        $bob = User::factory()->create([
            'name'     => 'Bob Builder',
            'username' => 'bob_builder',
            'email'    => 'bob@example.com',
        ]);

        Sanctum::actingAs($alice);

        // 1. Search by name
        $response = $this->getJson('/api/v1/search?q=Bob&type=users');
        $response->assertStatus(200);
        $response->assertJsonFragment(['username' => 'bob_builder']);
        $this->assertNotEmpty($response->json('data.users'));
        $this->assertNotEmpty($response->json('data.results.users'));

        // 2. Search by @username
        $responseAt = $this->getJson('/api/v1/search?q=@bob_builder&type=users');
        $responseAt->assertStatus(200);
        $responseAt->assertJsonFragment(['username' => 'bob_builder']);

        // 3. Search type all
        $responseAll = $this->getJson('/api/v1/search?q=Alice&type=all');
        $responseAll->assertStatus(200);
        $responseAll->assertJsonFragment(['username' => 'alicew']);
    }

    public function test_friends_search_endpoint_returns_users(): void
    {
        $user1 = User::factory()->create(['name' => 'Charlie Chaplin', 'username' => 'charlie']);
        $user2 = User::factory()->create(['name' => 'Dave Davids', 'username' => 'daved']);

        Sanctum::actingAs($user1);

        $response = $this->getJson('/api/v1/friends/search?q=Dave');
        $response->assertStatus(200);
        $response->assertJsonFragment(['username' => 'daved']);
        $this->assertEquals('daved', $response->json('data.data.0.username'));
    }
}
