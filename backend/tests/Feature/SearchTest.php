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

    public function test_suggested_creators_strictly_excludes_administrators_and_suspended_accounts(): void
    {
        // 1. Create ordinary creator
        $creator = User::factory()->create([
            'name' => 'Creator One',
            'username' => 'creator_one',
            'role' => 'creator',
            'status' => 'active',
        ]);

        // 2. Create admin account (role = admin)
        $adminRoleUser = User::factory()->create([
            'name' => 'Admin Boss',
            'username' => 'admin_boss',
            'role' => 'admin',
            'status' => 'active',
        ]);

        // 3. Create user with admin_role set
        $adminDesignatedUser = User::factory()->create([
            'name' => 'Moderator Lead',
            'username' => 'mod_lead',
            'role' => 'user',
            'admin_role' => 'moderator',
            'status' => 'active',
        ]);

        // 4. Create suspended user
        $suspendedUser = User::factory()->create([
            'name' => 'Suspended Guy',
            'username' => 'suspended_guy',
            'role' => 'creator',
            'status' => 'suspended',
        ]);

        // Test GET /discover/trending
        $resTrending = $this->getJson('/api/v1/discover/trending');
        $resTrending->assertStatus(200);
        $trendingCreators = $resTrending->json('data.suggested_creators') ?? $resTrending->json('suggested_creators');
        $this->assertNotEmpty($trendingCreators);

        $trendingUsernames = collect($trendingCreators)->pluck('username')->all();
        $this->assertContains('creator_one', $trendingUsernames);
        $this->assertNotContains('admin_boss', $trendingUsernames, 'Admin account must never appear in suggested creators');
        $this->assertNotContains('mod_lead', $trendingUsernames, 'User with admin_role must never appear in suggested creators');
        $this->assertNotContains('suspended_guy', $trendingUsernames, 'Suspended user must never appear in suggested creators');

        // Test GET /discover/creators (View All endpoint)
        $resAll = $this->getJson('/api/v1/discover/creators');
        $resAll->assertStatus(200);
        $creators = $resAll->json('data.creators') ?? $resAll->json('creators');
        $this->assertNotEmpty($creators);

        $creatorUsernames = collect($creators)->pluck('username')->all();
        $this->assertContains('creator_one', $creatorUsernames);
        $this->assertNotContains('admin_boss', $creatorUsernames, 'Admin account must never appear in View All creators');
        $this->assertNotContains('mod_lead', $creatorUsernames, 'User with admin_role must never appear in View All creators');
        $this->assertNotContains('suspended_guy', $creatorUsernames, 'Suspended user must never appear in View All creators');
    }

    public function test_user_search_and_users_search_strictly_exclude_admins(): void
    {
        $member = User::factory()->create([
            'name' => 'Ordinary Joe',
            'username' => 'ordinary_joe',
            'role' => 'member',
            'status' => 'active',
        ]);

        $admin = User::factory()->create([
            'name' => 'Administrator Jack',
            'username' => 'admin_jack',
            'role' => 'admin',
            'status' => 'active',
        ]);

        Sanctum::actingAs($member);

        // 1. /search?q=Admin&type=users
        $res = $this->getJson('/api/v1/search?q=Admin&type=users');
        $res->assertStatus(200);
        $resUsernames = collect($res->json('data.users') ?? $res->json('users') ?? [])->pluck('username')->all();
        $this->assertNotContains('admin_jack', $resUsernames);

        // 2. /users/search?q=Admin
        $resUsersSearch = $this->getJson('/api/v1/users/search?q=Admin');
        $resUsersSearch->assertStatus(200);
        $resSearchUsernames = collect($resUsersSearch->json('data.users') ?? $resUsersSearch->json('users') ?? [])->pluck('username')->all();
        $this->assertNotContains('admin_jack', $resSearchUsernames);

        // 3. /friends/search?q=Admin
        $resFriends = $this->getJson('/api/v1/friends/search?q=Admin');
        $resFriends->assertStatus(200);
        $resFriendsUsernames = collect($resFriends->json('data.data') ?? $resFriends->json('data') ?? [])->pluck('username')->all();
        $this->assertNotContains('admin_jack', $resFriendsUsernames);
    }

    public function test_public_profile_returns_404_for_admin_accounts(): void
    {
        $admin = User::factory()->create([
            'name' => 'Internal Super Admin',
            'username' => 'superadmin_internal',
            'role' => 'admin',
        ]);

        $creator = User::factory()->create([
            'name' => 'Public Creator',
            'username' => 'public_creator',
            'role' => 'creator',
        ]);

        // Public profile of regular creator returns 200
        $resCreator = $this->getJson('/api/v1/users/public_creator/public');
        $resCreator->assertStatus(200);

        // Public profile of admin returns 404
        $resAdmin = $this->getJson('/api/v1/users/superadmin_internal/public');
        $resAdmin->assertStatus(404);
    }
}
