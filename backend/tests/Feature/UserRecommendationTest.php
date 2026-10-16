<?php

namespace Tests\Feature;

use App\Models\Country;
use App\Models\Storefront;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserRecommendationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Country::firstOrCreate(['iso2' => 'NG'], [
            'iso3' => 'NGA',
            'name' => 'Nigeria',
            'calling_code' => '234',
            'flag' => '🇳🇬',
            'currency' => 'NGN',
        ]);

        Country::firstOrCreate(['iso2' => 'US'], [
            'iso3' => 'USA',
            'name' => 'United States',
            'calling_code' => '1',
            'flag' => '🇺🇸',
            'currency' => 'USD',
        ]);
    }

    public function test_suggested_creators_strictly_includes_only_creators(): void
    {
        $creator = User::factory()->create([
            'name' => 'True Creator',
            'username' => 'true_creator',
            'role' => 'creator',
            'status' => 'active',
        ]);

        $vendor = User::factory()->create([
            'name' => 'Shop Owner',
            'username' => 'shop_owner',
            'role' => 'vendor',
            'status' => 'active',
        ]);

        $member = User::factory()->create([
            'name' => 'Regular Member',
            'username' => 'regular_member',
            'role' => 'member',
            'status' => 'active',
        ]);

        $admin = User::factory()->create([
            'name' => 'Site Admin',
            'username' => 'site_admin',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $res = $this->getJson('/api/v1/discover/creators');
        $res->assertOk();

        $creators = $res->json('data.creators') ?? $res->json('creators') ?? [];
        $usernames = collect($creators)->pluck('username')->all();

        $this->assertContains('true_creator', $usernames);
        $this->assertNotContains('shop_owner', $usernames, 'Vendors must never appear in suggested creators');
        $this->assertNotContains('regular_member', $usernames, 'Members must never appear in suggested creators');
        $this->assertNotContains('site_admin', $usernames, 'Admins must never appear in suggested creators');
    }

    public function test_suggested_vendors_strictly_includes_only_vendors(): void
    {
        $creator = User::factory()->create([
            'name' => 'True Creator',
            'username' => 'true_creator',
            'role' => 'creator',
            'status' => 'active',
        ]);

        $vendor = User::factory()->create([
            'name' => 'Fashion Boutique',
            'username' => 'fashion_boutique',
            'role' => 'vendor',
            'status' => 'active',
        ]);

        Storefront::create([
            'user_id' => $vendor->id,
            'name' => 'Fashion Boutique Store',
            'display_name' => 'Fashion Boutique',
            'short_code' => 'fashion-boutique',
            'is_published' => true,
        ]);

        $member = User::factory()->create([
            'name' => 'Regular Member',
            'username' => 'regular_member',
            'role' => 'member',
            'status' => 'active',
        ]);

        $res = $this->getJson('/api/v1/discover/vendors');
        $res->assertOk();

        $vendors = $res->json('data.vendors') ?? $res->json('vendors') ?? [];
        $usernames = collect($vendors)->pluck('username')->all();

        $this->assertContains('fashion_boutique', $usernames);
        $this->assertNotContains('true_creator', $usernames, 'Creators must never appear in suggested vendors');
        $this->assertNotContains('regular_member', $usernames, 'Members must never appear in suggested vendors');

        // Verify store attributes are returned for vendor
        $vendorData = collect($vendors)->firstWhere('username', 'fashion_boutique');
        $this->assertEquals('Fashion Boutique', $vendorData['store_name']);
        $this->assertEquals('fashion-boutique', $vendorData['store_slug']);
    }

    public function test_trending_and_people_endpoints_return_both_creators_and_vendors(): void
    {
        User::factory()->create([
            'name' => 'Creator One',
            'username' => 'creator_one',
            'role' => 'creator',
            'status' => 'active',
        ]);

        User::factory()->create([
            'name' => 'Vendor One',
            'username' => 'vendor_one',
            'role' => 'vendor',
            'status' => 'active',
        ]);

        // Test /discover/trending
        $resTrending = $this->getJson('/api/v1/discover/trending');
        $resTrending->assertOk();

        $creators = $resTrending->json('data.suggested_creators') ?? $resTrending->json('suggested_creators') ?? [];
        $vendors = $resTrending->json('data.suggested_vendors') ?? $resTrending->json('suggested_vendors') ?? [];

        $creatorUsernames = collect($creators)->pluck('username')->all();
        $vendorUsernames = collect($vendors)->pluck('username')->all();

        $this->assertContains('creator_one', $creatorUsernames);
        $this->assertNotContains('vendor_one', $creatorUsernames);
        $this->assertContains('vendor_one', $vendorUsernames);
        $this->assertNotContains('creator_one', $vendorUsernames);

        // Test /discover/people
        $resPeople = $this->getJson('/api/v1/discover/people');
        $resPeople->assertOk();

        $peopleCreators = $resPeople->json('data.suggested_creators') ?? $resPeople->json('suggested_creators') ?? [];
        $peopleVendors = $resPeople->json('data.suggested_vendors') ?? $resPeople->json('suggested_vendors') ?? [];

        $this->assertContains('creator_one', collect($peopleCreators)->pluck('username')->all());
        $this->assertContains('vendor_one', collect($peopleVendors)->pluck('username')->all());
    }

    public function test_recommendation_prioritizes_location_match(): void
    {
        $viewer = User::factory()->create([
            'name' => 'Viewer In NG',
            'username' => 'viewer_ng',
            'country' => 'NG',
            'role' => 'member',
        ]);

        $ngCreator = User::factory()->create([
            'name' => 'Lagos Artist',
            'username' => 'lagos_artist',
            'country' => 'NG',
            'role' => 'creator',
            'status' => 'active',
        ]);

        $usCreator = User::factory()->create([
            'name' => 'NY Artist',
            'username' => 'ny_artist',
            'country' => 'US',
            'role' => 'creator',
            'status' => 'active',
        ]);

        Sanctum::actingAs($viewer);

        $res = $this->getJson('/api/v1/discover/creators');
        $res->assertOk();

        $creators = $res->json('data.creators') ?? $res->json('creators') ?? [];
        $this->assertNotEmpty($creators);

        // NG creator should have location-based reason or higher rank
        $lagosData = collect($creators)->firstWhere('username', 'lagos_artist');
        $this->assertNotNull($lagosData);
        $this->assertStringContainsString('Nigeria', $lagosData['reason']);
    }

    public function test_recommendation_prioritizes_friends_of_friends_and_engagements(): void
    {
        $viewer = User::factory()->create(['username' => 'viewer']);
        $friend = User::factory()->create(['username' => 'my_friend']);
        $popularFriendOfFriend = User::factory()->create([
            'username' => 'fof_creator',
            'role' => 'creator',
            'status' => 'active',
        ]);

        // Viewer follows friend
        DB::table('follows')->insert([
            'follower_id' => $viewer->id,
            'following_id' => $friend->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Friend follows creator
        DB::table('follows')->insert([
            'follower_id' => $friend->id,
            'following_id' => $popularFriendOfFriend->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Sanctum::actingAs($viewer);

        $res = $this->getJson('/api/v1/discover/creators');
        $res->assertOk();

        $creators = $res->json('data.creators') ?? $res->json('creators') ?? [];
        $fofData = collect($creators)->firstWhere('username', 'fof_creator');
        $this->assertNotNull($fofData);
        $this->assertStringContainsString('@my_friend', $fofData['reason']);
    }
}
