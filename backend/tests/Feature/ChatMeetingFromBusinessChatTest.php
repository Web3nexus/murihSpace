<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\DigitalProduct;
use App\Models\Meeting;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChatMeetingFromBusinessChatTest extends TestCase
{
    use RefreshDatabase;

    private User $buyer;
    private User $seller;
    private Conversation $chat;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buyer = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $this->seller = User::factory()->create(['role' => 'vendor', 'email_verified_at' => now()]);
        $this->chat = Conversation::create(['type' => 'direct']);
        ConversationParticipant::create(['conversation_id' => $this->chat->id, 'user_id' => $this->buyer->id]);
        ConversationParticipant::create(['conversation_id' => $this->chat->id, 'user_id' => $this->seller->id]);
    }

    private function placeOrder(): void
    {
        $product = DigitalProduct::create([
            'creator_id' => $this->seller->id, 'title' => 'Pack', 'slug' => 'pack-'.uniqid(), 'price' => 100,
        ]);

        Order::create([
            'order_number' => 'ORD-'.uniqid(), 'buyer_id' => $this->buyer->id, 'creator_id' => $this->seller->id,
            'product_id' => $product->id, 'idempotency_key' => 'k-'.uniqid(), 'subtotal' => 100, 'platform_fee' => 5,
            'tax' => 0, 'total' => 105, 'currency' => 'USD', 'status' => 'completed', 'paid_at' => now(),
            'payment_provider' => 'mock',
        ]);
    }

    public function test_an_ordinary_chat_cannot_start_a_meeting(): void
    {
        Sanctum::actingAs($this->buyer);

        $this->postJson("/api/v1/conversations/{$this->chat->id}/meeting")
            ->assertStatus(403)
            ->assertJsonPath('errors.code', 'NOT_BUSINESS_CHAT');

        $this->assertSame(0, Meeting::count());
    }

    public function test_either_party_can_start_a_meeting_in_a_vendor_order_chat(): void
    {
        $this->placeOrder();

        // The buyer, who is a member and not a creator, can start one.
        Sanctum::actingAs($this->buyer);
        $response = $this->postJson("/api/v1/conversations/{$this->chat->id}/meeting")
            ->assertStatus(201);

        $code = $response->json('data.code');
        $this->assertStringContainsString("/m/{$code}", $response->json('data.url'));

        $meeting = Meeting::where('code', $code)->firstOrFail();
        $this->assertSame($this->buyer->id, $meeting->host_user_id);

        // The seller can start one too.
        Sanctum::actingAs($this->seller);
        $this->postJson("/api/v1/conversations/{$this->chat->id}/meeting")->assertStatus(201);
        $this->assertSame(2, Meeting::count());
    }

    public function test_business_flag_is_listed_on_the_conversation(): void
    {
        Sanctum::actingAs($this->buyer);
        $this->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.is_business', false);

        $this->placeOrder();

        $this->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.is_business', true);
    }

    public function test_a_brand_deal_proposal_makes_the_chat_a_business_chat(): void
    {
        $brandContact = User::factory()->create(['role' => 'member', 'email_verified_at' => now(), 'email' => 'brand.contact@example.com']);
        $chat = Conversation::create(['type' => 'direct']);
        ConversationParticipant::create(['conversation_id' => $chat->id, 'user_id' => $this->seller->id]);
        ConversationParticipant::create(['conversation_id' => $chat->id, 'user_id' => $brandContact->id]);

        \App\Models\BrandDealProposal::create([
            'creator_id' => $this->seller->id,
            'brand_name' => 'Acme',
            'brand_email' => 'Brand.Contact@example.com',
            'title' => 'Sponsored post',
            'pitch' => 'A short sponsored post.',
            'proposed_budget' => 500,
            'currency' => 'USD',
            'status' => 'sent',
            'sent_at' => now(),
        ]);

        Sanctum::actingAs($brandContact);
        $this->getJson('/api/v1/conversations')
            ->assertOk();

        $listed = collect($this->getJson('/api/v1/conversations')->json('data'))
            ->firstWhere('id', $chat->id);
        $this->assertTrue($listed['is_business']);
    }
}
