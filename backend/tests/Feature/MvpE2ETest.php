<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\DigitalProduct;
use App\Models\Post;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MvpE2ETest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsCreator(): User
    {
        $user = User::factory()->create([
            'role' => 'creator',
            'email_verified_at' => now(),
            'username' => 'creator_'.fake()->unique()->bothify('####'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    protected function actingAsMember(): User
    {
        $user = User::factory()->create([
            'role' => 'member',
            'email_verified_at' => now(),
            'username' => 'member_'.fake()->unique()->bothify('####'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    protected function actingAsAdmin(): User
    {
        $user = User::factory()->create([
            'role' => 'admin',
            'email_verified_at' => now(),
            'username' => 'admin_'.fake()->unique()->bothify('####'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    // ──────────────────────────────────────────────
    // 1. Full Creator Journey
    // ──────────────────────────────────────────────

    public function test_creator_full_journey(): void
    {
        $creator = $this->actingAsCreator();

        // 1a. Create a community
        $communityRes = $this->postJson('/api/v1/my-communities', [
            'name' => 'Creator Hub',
            'description' => 'A community for creators',
            'category' => 'Technology',
            'visibility' => 'public',
            'pricing_type' => 'free',
        ]);
        $communityRes->assertStatus(201);
        $communityId = $communityRes->json('data.community.id');

        // 1b. Create a post in the community
        $postRes = $this->postJson('/api/v1/posts', [
            'community_id' => $communityId,
            'type' => 'post',
            'content' => 'Welcome to the Creator Hub!',
        ]);
        $postRes->assertStatus(201);
        $this->assertDatabaseHas('posts', ['content' => 'Welcome to the Creator Hub!']);

        // 1c. Create a storefront
        $storeRes = $this->getJson('/api/v1/storefront');
        $storeRes->assertStatus(200);

        $updateStoreRes = $this->putJson('/api/v1/storefront', [
            'display_name' => 'Creator Shop',
            'tagline' => 'Digital goods',
            'bio' => 'Best digital products',
            'short_code' => $creator->username,
            'links' => [['label' => 'Twitter', 'url' => 'https://twitter.com/test']],
        ]);
        $updateStoreRes->assertStatus(200);

        $publishRes = $this->postJson('/api/v1/storefront/publish', [
            'is_published' => true,
        ]);
        $publishRes->assertStatus(200);

        // 1d. Create a digital product
        $productRes = $this->postJson('/api/v1/store/products', [
            'title' => 'E-Book: Creator Guide',
            'description' => 'A comprehensive guide',
            'price' => 9.99,
            'currency' => 'USD',
            'is_free' => false,
            'category' => 'ebook',
            'status' => 'published',
        ]);
        $productRes->assertStatus(201);
        $productId = $productRes->json('data.data.id');

        $this->assertDatabaseHas('digital_products', [
            'id' => $productId,
            'creator_id' => $creator->id,
            'status' => 'published',
        ]);

        // 1e. Public storefront is visible
        $publicStoreRes = $this->getJson("/api/v1/stores/{$creator->username}");
        $publicStoreRes->assertStatus(200);

        // 1f. Public product is visible
        $slug = $productRes->json('data.data.slug');
        $publicProductRes = $this->getJson("/api/v1/public/products/{$slug}");
        $publicProductRes->assertStatus(200);
    }

    // ──────────────────────────────────────────────
    // 2. Member Journey
    // ──────────────────────────────────────────────

    public function test_member_full_journey(): void
    {
        $creator = User::factory()->create(['role' => 'creator', 'email_verified_at' => now()]);
        Sanctum::actingAs($creator);
        $community = Community::factory()->create([
            'user_id' => $creator->id,
            'visibility' => 'public',
        ]);

        $member = $this->actingAsMember();

        // 2a. Discover communities
        $discoverRes = $this->getJson('/api/v1/communities');
        $discoverRes->assertStatus(200);

        // 2b. Join public community
        $joinRes = $this->postJson("/api/v1/communities/{$community->id}/join");
        $joinRes->assertStatus(200);
        $this->assertDatabaseHas('community_memberships', [
            'community_id' => $community->id,
            'user_id' => $member->id,
            'status' => 'active',
        ]);

        // 2c. Create a text status
        $postRes = $this->postJson('/api/v1/posts', [
            'community_id' => $community->id,
            'type' => 'status',
            'content' => 'Hello from a member!',
        ]);
        $postRes->assertStatus(201);

        // 2d. React to creator's post
        $creatorPost = Post::factory()->create([
            'community_id' => $community->id,
            'user_id' => $creator->id,
        ]);
        $reactRes = $this->postJson("/api/v1/posts/{$creatorPost->id}/reactions", [
            'reaction_type' => 'like',
        ]);
        $reactRes->assertStatus(200);
        $this->assertTrue($reactRes->json('data.reacted'));
    }

    // ──────────────────────────────────────────────
    // 3. Purchase and Download Journey
    // ──────────────────────────────────────────────

    public function test_purchase_and_download_journey(): void
    {
        $creator = User::factory()->create(['role' => 'creator', 'email_verified_at' => now()]);
        Sanctum::actingAs($creator);
        $product = DigitalProduct::create([
            'creator_id' => $creator->id,
            'title' => 'Test Product',
            'slug' => 'test-product-'.fake()->unique()->bothify('####'),
            'price' => 5.00,
            'currency' => 'USD',
            'is_free' => false,
            'category' => 'ebook',
            'status' => 'published',
        ]);

        $buyer = $this->actingAsMember();
        Wallet::create([
            'user_id' => $buyer->id,
            'balance' => 10000,
            'currency' => 'USD',
        ]);

        // 3a. Create checkout intent
        $intentRes = $this->postJson('/api/v1/checkout/intent', [
            'product_id' => $product->id,
            'idempotency_key' => 'test-ik-'.now()->timestamp,
            'payment_provider' => 'mock',
        ]);
        $intentRes->assertStatus(201);
        $orderId = $intentRes->json('data.data.order.id');

        // 3b. Complete mock payment
        $completeRes = $this->postJson('/api/v1/checkout/complete-mock', [
            'order_id' => $orderId,
        ]);
        $completeRes->assertStatus(200);

        // 3c. Verify purchase exists
        $purchasesRes = $this->getJson('/api/v1/wallet/purchases');
        $purchasesRes->assertStatus(200);
    }

    // ──────────────────────────────────────────────
    // 4. Donation Journey
    // ──────────────────────────────────────────────

    public function test_donation_journey(): void
    {
        $creator = User::factory()->create([
            'role' => 'creator',
            'email_verified_at' => now(),
            'username' => 'creator_donatetest',
        ]);
        Wallet::create(['user_id' => $creator->id, 'balance' => 0, 'currency' => 'USD']);

        $donor = $this->actingAsMember();
        Wallet::create(['user_id' => $donor->id, 'balance' => 50000, 'currency' => 'USD']);

        // Fund wallet and add PIN for donor
        $donorWallet = Wallet::where('user_id', $donor->id)->first();
        $donorWallet->update([
            'pin_hash' => hash('sha256', '1234'),
            'pin_set_at' => now(),
            'status' => 'active',
        ]);

        $donationRes = $this->postJson('/api/v1/wallet/donations/send', [
            'recipient_username' => $creator->username ?? $creator->email,
            'amount' => 1000,
            'currency' => 'USD',
            'is_anonymous' => false,
            'pin' => '1234',
        ]);
        $donationRes->assertStatus(201);

        $this->assertDatabaseHas('donations', [
            'sender_id' => $donor->id,
            'recipient_id' => $creator->id,
            'amount' => 1000,
        ]);

        $sentRes = $this->getJson('/api/v1/wallet/donations/sent');
        $sentRes->assertStatus(200);
    }

    // ──────────────────────────────────────────────
    // 5. Messaging Journey
    // ──────────────────────────────────────────────

    public function test_messaging_journey(): void
    {
        $userA = $this->actingAsMember();
        $userB = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);

        // 5a. User A starts a direct conversation with User B
        $startRes = $this->postJson('/api/v1/conversations/direct', [
            'user_id' => $userB->id,
        ]);
        $startRes->assertStatus(201);
        $convId = $startRes->json('data.data.id');

        // 5b. User A sends a message
        $msgRes = $this->postJson("/api/v1/conversations/{$convId}/messages", [
            'content' => 'Hey there!',
        ]);
        $msgRes->assertStatus(201);

        // 5c. User B can read messages
        Sanctum::actingAs($userB);
        $readRes = $this->getJson("/api/v1/conversations/{$convId}/messages");
        $readRes->assertStatus(200);

        // 5d. User B marks as read
        $markRes = $this->postJson("/api/v1/conversations/{$convId}/read");
        $markRes->assertStatus(200);
    }

    // ──────────────────────────────────────────────
    // 6. Admin Journey
    // ──────────────────────────────────────────────

    public function test_admin_journey(): void
    {
        $creator = User::factory()->create([
            'role' => 'creator',
            'kyc_status' => 'pending',
            'kyc_document' => 'PASSPORT-ADMIN-TEST',
            'email_verified_at' => now(),
        ]);

        $this->actingAsAdmin();

        // 6a. View dashboard stats
        $dashRes = $this->getJson('/api/v1/securegate/dashboard');
        $dashRes->assertStatus(200);

        // 6b. List users
        $usersRes = $this->getJson('/api/v1/securegate/users');
        $usersRes->assertStatus(200);

        // 6c. View KYC queue
        $kycRes = $this->getJson('/api/v1/securegate/kyc');
        $kycRes->assertStatus(200);

        // 6d. Approve KYC
        $approveRes = $this->postJson("/api/v1/securegate/kyc/{$creator->id}/approve");
        $approveRes->assertStatus(200);
        $this->assertDatabaseHas('users', [
            'id' => $creator->id,
            'kyc_status' => 'verified',
        ]);

        // 6e. View audit logs
        $auditRes = $this->getJson('/api/v1/securegate/audit-logs');
        $auditRes->assertStatus(200);

        // 6f. Create feature flag
        $flagRes = $this->postJson('/api/v1/securegate/feature-flags', [
            'key' => 'test_feature',
            'label' => 'Test Feature',
            'description' => 'A test feature flag',
            'enabled' => true,
        ]);
        $flagRes->assertStatus(201);
    }

    // ──────────────────────────────────────────────
    // 7. Security: Non-admin cannot access admin routes
    // ──────────────────────────────────────────────

    public function test_non_admin_cannot_access_securegate(): void
    {
        $this->actingAsMember();

        $endpoints = [
            '/api/v1/securegate/dashboard',
            '/api/v1/securegate/users',
            '/api/v1/securegate/kyc',
            '/api/v1/securegate/audit-logs',
            '/api/v1/securegate/feature-flags',
            '/api/v1/securegate/cms',
        ];

        foreach ($endpoints as $path) {
            $response = $this->getJson($path);
            $response->assertStatus(403);
        }
    }

    // ──────────────────────────────────────────────
    // 8. Link sharing restrictions
    // ──────────────────────────────────────────────

    public function test_member_link_sharing_is_restricted(): void
    {
        $creator = User::factory()->create(['role' => 'creator', 'email_verified_at' => now()]);
        Sanctum::actingAs($creator);
        $community = Community::factory()->create([
            'user_id' => $creator->id,
            'visibility' => 'public',
        ]);

        $member = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        Sanctum::actingAs($member);
        $this->postJson("/api/v1/communities/{$community->id}/join");

        // Post with URL in content should be rejected
        $response = $this->postJson('/api/v1/posts', [
            'community_id' => $community->id,
            'type' => 'status',
            'content' => 'Check out https://example.com',
        ]);
        $response->assertStatus(403);
        $response->assertJson([
            'errors' => ['error_code' => 'LINK_SHARING_RESTRICTED'],
        ]);
    }

    // ──────────────────────────────────────────────
    // 9. API readiness
    // ──────────────────────────────────────────────

    public function test_api_readiness(): void
    {
        $response = $this->getJson('/api/v1/ready');
        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'status' => 'ready',
                'services' => ['database' => 'connected'],
            ],
        ]);
    }

    // ──────────────────────────────────────────────
    // 10. Auth: Unauthenticated access is rejected
    // ──────────────────────────────────────────────

    public function test_unauthenticated_access_is_rejected(): void
    {
        $endpoints = [
            'GET /api/v1/profile',
            'GET /api/v1/my-communities',
            'GET /api/v1/storefront',
            'GET /api/v1/wallet',
        ];

        foreach ($endpoints as $endpoint) {
            [$method, $path] = explode(' ', $endpoint, 2);
            $response = $this->json($method, $path);
            $response->assertStatus(401);
        }
    }
}
