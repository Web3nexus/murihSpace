<?php

namespace Tests\Feature;

use App\Events\MessageSent;
use App\Events\TypingIndicator;
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

class ChatAndThreadingFeatureTest extends TestCase
{
    use RefreshDatabase;

    private User $alice;
    private User $bob;
    private User $charlie;

    protected function setUp(): void
    {
        parent::setUp();
        $this->alice = User::factory()->create(['name' => 'Alice', 'role' => 'creator', 'email_verified_at' => now()]);
        $this->bob = User::factory()->create(['name' => 'Bob', 'role' => 'member', 'email_verified_at' => now()]);
        $this->charlie = User::factory()->create(['name' => 'Charlie', 'role' => 'member', 'email_verified_at' => now()]);
    }

    public function test_direct_conversation_creation_and_listing(): void
    {
        Sanctum::actingAs($this->alice);

        // Start direct conversation with Bob
        $response = $this->postJson('/api/v1/conversations/direct', [
            'user_id' => $this->bob->id,
        ]);

        $response->assertStatus(201);

        $conversationId = $response->json('data.data.id') ?? $response->json('data.id');
        $this->assertNotNull($conversationId);

        // List conversations for Alice
        $listResponse = $this->getJson('/api/v1/conversations');
        $listResponse->assertOk();
        $conversations = $listResponse->json('data.data') ?? $listResponse->json('data');
        $this->assertCount(1, $conversations);
        $this->assertEquals($conversationId, $conversations[0]['id']);
    }

    public function test_sending_message_with_threading_reply(): void
    {
        Event::fake([MessageSent::class]);
        Sanctum::actingAs($this->alice);

        $convRes = $this->postJson('/api/v1/conversations/direct', ['user_id' => $this->bob->id]);
        $convRes->assertStatus(201);
        $convId = $convRes->json('data.data.id') ?? $convRes->json('data.id');

        // Alice sends initial message
        $msg1Res = $this->postJson("/api/v1/conversations/{$convId}/messages", [
            'content' => 'Hello Bob! This is thread root.',
            'client_uuid' => 'uuid-msg-1',
        ]);
        $msg1Res->assertStatus(201);
        $rootMsgId = $msg1Res->json('data.data.id') ?? $msg1Res->json('data.id');

        Event::assertDispatched(MessageSent::class);

        // Bob logs in and replies to the thread
        Sanctum::actingAs($this->bob);
        $replyRes = $this->postJson("/api/v1/conversations/{$convId}/messages", [
            'content' => 'Hi Alice, replying in thread!',
            'reply_to_id' => $rootMsgId,
            'client_uuid' => 'uuid-msg-2',
        ]);

        $replyRes->assertStatus(201);
        $replyData = $replyRes->json('data.data') ?? $replyRes->json('data');
        $this->assertEquals($rootMsgId, $replyData['reply_to_id']);
        $this->assertEquals('Hello Bob! This is thread root.', $replyData['reply_to']['content']);

        // Get messages history
        $historyRes = $this->getJson("/api/v1/conversations/{$convId}/messages");
        $historyRes->assertOk();
        $historyList = $historyRes->json('data.data') ?? $historyRes->json('data');
        $this->assertCount(2, $historyList);
    }

    public function test_typing_indicator_and_mark_read(): void
    {
        Event::fake([TypingIndicator::class]);
        Sanctum::actingAs($this->alice);

        $convRes = $this->postJson('/api/v1/conversations/direct', ['user_id' => $this->bob->id]);
        $convRes->assertStatus(201);
        $convId = $convRes->json('data.data.id') ?? $convRes->json('data.id');

        // Alice types
        $typingRes = $this->postJson("/api/v1/conversations/{$convId}/typing", ['is_typing' => true]);
        $typingRes->assertOk();
        Event::assertDispatched(TypingIndicator::class);

        // Alice sends message
        $this->postJson("/api/v1/conversations/{$convId}/messages", [
            'content' => 'Unread message for Bob',
        ]);

        // Bob checks unread count before marking read
        Sanctum::actingAs($this->bob);
        $listRes = $this->getJson('/api/v1/conversations');
        $conversations = $listRes->json('data.data') ?? $listRes->json('data');
        $this->assertEquals(1, $conversations[0]['unread_count']);

        // Bob marks conversation read
        $readRes = $this->postJson("/api/v1/conversations/{$convId}/read");
        $readRes->assertOk();

        // Check unread count after read
        $listAfter = $this->getJson('/api/v1/conversations');
        $conversationsAfter = $listAfter->json('data.data') ?? $listAfter->json('data');
        $this->assertEquals(0, $conversationsAfter[0]['unread_count']);
    }

    public function test_community_chat_access_and_messaging(): void
    {
        $community = Community::factory()->create(['user_id' => $this->alice->id]);
        CommunityMembership::create([
            'community_id' => $community->id,
            'user_id' => $this->bob->id,
            'status' => 'active',
            'role' => 'member',
        ]);

        // Alice (owner) accesses community chat
        Sanctum::actingAs($this->alice);
        $commChatRes = $this->getJson("/api/v1/conversations/community/{$community->id}");
        $commChatRes->assertOk();
        $convId = $commChatRes->json('data.data.id') ?? $commChatRes->json('data.id');

        // Bob (member) accesses community chat and sends message
        Sanctum::actingAs($this->bob);
        $msgRes = $this->postJson("/api/v1/conversations/{$convId}/messages", [
            'content' => 'Hello community!',
        ]);
        $msgRes->assertStatus(201);

        // Charlie (non-member) cannot access community chat
        Sanctum::actingAs($this->charlie);
        $charlieRes = $this->getJson("/api/v1/conversations/community/{$community->id}");
        $charlieRes->assertForbidden();
    }

    public function test_forwarding_message(): void
    {
        Sanctum::actingAs($this->alice);

        $res1 = $this->postJson('/api/v1/conversations/direct', ['user_id' => $this->bob->id]);
        $convAliceBob = $res1->json('data.data.id') ?? $res1->json('data.id');

        $res2 = $this->postJson('/api/v1/conversations/direct', ['user_id' => $this->charlie->id]);
        $convAliceCharlie = $res2->json('data.data.id') ?? $res2->json('data.id');

        // Alice sends message to Bob
        $msgRes = $this->postJson("/api/v1/conversations/{$convAliceBob}/messages", ['content' => 'Top secret announcement']);
        $msgId = $msgRes->json('data.data.id') ?? $msgRes->json('data.id');

        // Alice forwards this message to Charlie
        $fwdRes = $this->postJson("/api/v1/messages/{$msgId}/forward", [
            'to_conversation_id' => $convAliceCharlie,
        ]);

        $fwdRes->assertStatus(201);
        $fwdData = $fwdRes->json('data.data') ?? $fwdRes->json('data');
        $this->assertEquals($msgId, $fwdData['forwarded_from_message_id']);
        $this->assertEquals('Top secret announcement', $fwdData['content']);
    }
}

