<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\DigitalProduct;
use App\Models\PhysicalProduct;
use App\Models\Storefront;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StorefrontTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_view_published_storefront(): void
    {
        $creator = User::factory()->create(['role' => 'creator']);
        $store = Storefront::create([
            'user_id' => $creator->id,
            'display_name' => 'Creator Shop',
            'short_code' => 'creatorshop',
            'is_published' => true,
        ]);

        Community::create([
            'user_id' => $creator->id,
            'name' => 'Creator Community',
            'slug' => 'creator-comm',
            'visibility' => 'public',
        ]);

        $response = $this->getJson("/api/v1/stores/{$store->short_code}");
        // dump($response->json());
        $response->assertOk();
        $this->assertEquals('Creator Shop', $response->json('data.data.display_name') ?? $response->json('data.display_name'));
        $this->assertTrue((bool) ($response->json('data.data.is_published') ?? $response->json('data.is_published')));
    }

    public function test_guest_cannot_view_unpublished_storefront(): void
    {
        $creator = User::factory()->create(['role' => 'creator']);
        $store = Storefront::create([
            'user_id' => $creator->id,
            'display_name' => 'Draft Shop',
            'short_code' => 'draftshop',
            'is_published' => false,
        ]);

        $response = $this->getJson("/api/v1/stores/{$store->short_code}");

        $response->assertStatus(404);
    }

    public function test_creator_can_preview_their_own_unpublished_storefront(): void
    {
        $creator = User::factory()->create(['role' => 'creator']);
        $store = Storefront::create([
            'user_id' => $creator->id,
            'display_name' => 'Draft Shop',
            'short_code' => 'draftshop',
            'is_published' => false,
        ]);

        $response = $this->actingAs($creator, 'sanctum')
            ->getJson("/api/v1/stores/{$store->short_code}?preview=true");

        $response->assertOk();
        $this->assertEquals('Draft Shop', $response->json('data.data.display_name') ?? $response->json('data.display_name'));
        $this->assertTrue((bool) ($response->json('data.data.is_preview') ?? $response->json('data.is_preview')));
        $this->assertTrue((bool) ($response->json('data.data.is_owner') ?? $response->json('data.is_owner')));
    }

    public function test_creator_can_toggle_publish(): void
    {
        $creator = User::factory()->create(['role' => 'creator']);
        $store = Storefront::create([
            'user_id' => $creator->id,
            'display_name' => 'My Shop',
            'short_code' => 'myshop',
            'is_published' => false,
        ]);

        $response = $this->actingAs($creator, 'sanctum')
            ->postJson('/api/v1/storefront/publish', ['is_published' => true]);

        $response->assertOk();
        $this->assertTrue((bool) ($response->json('data.data.is_published') ?? $response->json('data.is_published')));

        $this->assertDatabaseHas('storefronts', [
            'id' => $store->id,
            'is_published' => true,
        ]);
    }
}
