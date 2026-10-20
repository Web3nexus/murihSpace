<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Escrow;
use App\Models\Message;
use App\Models\User;
use App\Services\Chat\BusinessChatPolicy;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BusinessChatDeletionTest extends TestCase
{
    use RefreshDatabase;

    private User $buyer;
    private User $seller;
    private Conversation $chat;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-10-19 09:00:00'));

        $this->buyer = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $this->seller = User::factory()->create(['role' => 'creator', 'email_verified_at' => now()]);
        $this->chat = Conversation::create(['type' => 'direct']);
        ConversationParticipant::create(['conversation_id' => $this->chat->id, 'user_id' => $this->buyer->id]);
        ConversationParticipant::create(['conversation_id' => $this->chat->id, 'user_id' => $this->seller->id]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function withEscrow(): void
    {
        Escrow::create(['buyer_id' => $this->buyer->id, 'seller_id' => $this->seller->id, 'amount' => 1000, 'currency' => 'USD', 'status' => 'released']);
    }

    private function message(User $sender, ?Carbon $at = null): Message
    {
        $message = Message::create(['conversation_id' => $this->chat->id, 'user_id' => $sender->id, 'content' => 'Hi', 'type' => 'text']);
        if ($at) {
            Message::where('id', $message->id)->update(['created_at' => $at]);
        }

        return $message->fresh();
    }

    public function test_business_chat_cannot_delete_for_everyone_while_active(): void
    {
        $this->withEscrow();
        $message = $this->message($this->buyer, Carbon::now()->subDays(10));
        Sanctum::actingAs($this->buyer);

        $response = $this->deleteJson("/api/v1/conversations/{$this->chat->id}/messages/{$message->id}", ['mode' => 'everyone'])
            ->assertStatus(403)
            ->assertJsonPath('message', BusinessChatPolicy::LOCKED_MESSAGE);

        // The lock date is returned so the app can show when deleting opens.
        // The envelope carries extra keys under `errors`.
        $this->assertNotNull($response->json('errors.unlocks_at'));

        $this->assertDatabaseHas('messages', ['id' => $message->id, 'content' => 'Hi']);
    }

    public function test_business_chat_cannot_clear_for_everyone_while_active(): void
    {
        $this->withEscrow();
        $this->message($this->seller, Carbon::now()->subMonths(2));
        Sanctum::actingAs($this->seller);

        $this->deleteJson("/api/v1/conversations/{$this->chat->id}/messages", ['mode' => 'everyone'])->assertStatus(403);
    }

    public function test_deleting_for_me_stays_allowed_in_a_business_chat(): void
    {
        $this->withEscrow();
        $message = $this->message($this->buyer);
        Sanctum::actingAs($this->buyer);

        $this->deleteJson("/api/v1/conversations/{$this->chat->id}/messages/{$message->id}", ['mode' => 'me'])->assertOk();
    }

    public function test_business_chat_opens_six_months_after_the_last_message(): void
    {
        $this->withEscrow();
        $message = $this->message($this->buyer, Carbon::now()->subMonth());
        Sanctum::actingAs($this->buyer);

        // Four months and 20 days after the test start, five months short of the unlock date: still locked.
        Carbon::setTestNow(Carbon::now()->addMonths(4)->addDays(20));
        $this->deleteJson("/api/v1/conversations/{$this->chat->id}/messages/{$message->id}", ['mode' => 'everyone'])->assertStatus(403);

        // Past six months after the last message (one month before the test start): the lock lifts.
        // The normal rules then apply, so this old message is outside the 15-minute window and is refused for a different reason.
        Carbon::setTestNow(Carbon::parse('2026-10-19 09:00:00')->addMonths(5)->addDay());
        $this->assertNull(app(BusinessChatPolicy::class)->unlocksAt($this->chat->fresh()));
        $this->deleteJson("/api/v1/conversations/{$this->chat->id}/messages/{$message->id}", ['mode' => 'everyone'])
            ->assertStatus(422)
            ->assertJsonMissing(['message' => BusinessChatPolicy::LOCKED_MESSAGE]);
    }

    public function test_a_new_message_restarts_the_six_month_lock(): void
    {
        $this->withEscrow();
        $this->message($this->buyer, Carbon::now()->subMonths(7));
        $this->message($this->seller, Carbon::now());

        $this->assertNotNull(app(BusinessChatPolicy::class)->unlocksAt($this->chat->fresh()));
    }

    public function test_an_ordinary_chat_is_not_locked(): void
    {
        $message = $this->message($this->buyer);
        Sanctum::actingAs($this->buyer);

        // No escrow between them, so the normal rules apply: the sender can delete for everyone within the window.
        $this->deleteJson("/api/v1/conversations/{$this->chat->id}/messages/{$message->id}", ['mode' => 'everyone'])->assertOk();
    }

    public function test_the_messages_response_carries_the_unlock_date_for_a_locked_business_chat(): void
    {
        $this->withEscrow();
        $this->message($this->buyer, Carbon::now()->subDay());
        Sanctum::actingAs($this->buyer);

        $body = $this->getJson("/api/v1/conversations/{$this->chat->id}/messages")->assertOk()->json();

        // The envelope puts the paginated body under `data`.
        $this->assertNotNull($body['data']['delete_for_everyone_unlocks_at'] ?? null);
    }
}
