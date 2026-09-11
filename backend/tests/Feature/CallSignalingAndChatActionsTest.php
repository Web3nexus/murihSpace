<?php

namespace Tests\Feature;

use App\Events\CallAccepted;
use App\Events\CallDeclined;
use App\Events\CallEnded;
use App\Events\CallIncoming;
use App\Models\Call;
use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CallSignalingAndChatActionsTest extends TestCase
{
    use RefreshDatabase;

    private User $user1;
    private User $user2;
    private Conversation $conv;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user1 = User::factory()->create(['name' => 'Alice']);
        $this->user2 = User::factory()->create(['name' => 'Bob']);

        $this->conv = Conversation::create(['type' => 'direct']);
        ConversationParticipant::create(['conversation_id' => $this->conv->id, 'user_id' => $this->user1->id]);
        ConversationParticipant::create(['conversation_id' => $this->conv->id, 'user_id' => $this->user2->id]);
    }

    public function test_user_can_initiate_audio_call(): void
    {
        Event::fake([CallIncoming::class]);
        Sanctum::actingAs($this->user1);

        $response = $this->postJson('/api/v1/calls/initiate', [
            'recipient_id' => $this->user2->id,
            'type' => 'audio',
            'conversation_id' => $this->conv->id,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.call.caller_id', $this->user1->id);
        $response->assertJsonPath('data.call.recipient_id', $this->user2->id);
        $response->assertJsonPath('data.call.status', 'ringing');

        Event::assertDispatched(CallIncoming::class, function ($event) {
            return $event->call->recipient_id === $this->user2->id;
        });

        $this->assertDatabaseHas('calls', [
            'caller_id' => $this->user1->id,
            'recipient_id' => $this->user2->id,
            'type' => 'audio',
            'status' => 'ringing',
        ]);
    }

    public function test_recipient_can_accept_call(): void
    {
        Event::fake([CallAccepted::class]);

        $call = Call::create([
            'caller_id' => $this->user1->id,
            'recipient_id' => $this->user2->id,
            'type' => 'video',
            'status' => 'ringing',
            'room_name' => 'call_test_123',
        ]);

        Sanctum::actingAs($this->user2);
        $response = $this->postJson("/api/v1/calls/{$call->id}/accept");

        $response->assertOk();
        $response->assertJsonPath('data.call.status', 'accepted');

        Event::assertDispatched(CallAccepted::class);

        $this->assertDatabaseHas('calls', [
            'id' => $call->id,
            'status' => 'accepted',
        ]);
    }

    public function test_recipient_can_decline_call(): void
    {
        Event::fake([CallDeclined::class]);

        $call = Call::create([
            'caller_id' => $this->user1->id,
            'recipient_id' => $this->user2->id,
            'type' => 'audio',
            'status' => 'ringing',
            'room_name' => 'call_test_declined',
        ]);

        Sanctum::actingAs($this->user2);
        $response = $this->postJson("/api/v1/calls/{$call->id}/decline");

        $response->assertOk();
        Event::assertDispatched(CallDeclined::class);

        $this->assertDatabaseHas('calls', [
            'id' => $call->id,
            'status' => 'declined',
        ]);
    }

    public function test_user_can_clear_chat_for_everyone(): void
    {
        Sanctum::actingAs($this->user1);

        Message::create([
            'conversation_id' => $this->conv->id,
            'user_id' => $this->user1->id,
            'content' => 'First message',
            'type' => 'text',
        ]);
        Message::create([
            'conversation_id' => $this->conv->id,
            'user_id' => $this->user2->id,
            'content' => 'Second message',
            'type' => 'text',
        ]);

        $response = $this->deleteJson("/api/v1/conversations/{$this->conv->id}/messages", [
            'mode' => 'everyone',
        ]);

        $response->assertOk();
        $response->assertJson(['message' => 'Chat history cleared for everyone.']);

        $this->assertSoftDeleted('messages', ['content' => '']);
    }

    public function test_user_can_get_mutual_communities(): void
    {
        Sanctum::actingAs($this->user1);

        $community = Community::factory()->create(['name' => 'Web3 Pioneers', 'category' => 'Web3']);
        CommunityMembership::create(['community_id' => $community->id, 'user_id' => $this->user1->id, 'status' => 'active', 'role' => 'member']);
        CommunityMembership::create(['community_id' => $community->id, 'user_id' => $this->user2->id, 'status' => 'active', 'role' => 'member']);

        $response = $this->getJson("/api/v1/users/{$this->user2->id}/mutual-communities");

        $response->assertOk();
        $response->assertJsonPath('data.count', 1);
        $response->assertJsonPath('data.communities.0.name', 'Web3 Pioneers');
        $response->assertJsonPath('data.communities.0.tag', '#Web3');
    }
}
