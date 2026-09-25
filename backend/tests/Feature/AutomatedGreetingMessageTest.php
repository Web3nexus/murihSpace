<?php

namespace Tests\Feature;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AutomatedGreetingMessageTest extends TestCase
{
    use RefreshDatabase;

    private User $creator;
    private User $member;

    protected function setUp(): void
    {
        parent::setUp();

        $this->creator = User::factory()->create([
            'name' => 'Creator Vincent',
            'role' => 'creator',
            'email_verified_at' => now(),
            'greeting_message_enabled' => true,
            'greeting_message' => 'Hello! Thanks for reaching out. How can I help you today?',
            'away_message_enabled' => true,
            'away_message' => 'Thanks for reaching out! I am currently away and will reply shortly.',
            'last_seen_at' => now()->subMinutes(10), // offline
            'show_online_status' => true,
        ]);

        $this->member = User::factory()->create([
            'name' => 'Member Alice',
            'role' => 'member',
            'email_verified_at' => now(),
        ]);
    }

    public function test_automated_greeting_message_is_sent_on_first_inbound_message(): void
    {
        Event::fake([MessageSent::class]);

        Sanctum::actingAs($this->member);

        // Member Alice starts direct conversation with Creator Vincent
        $convRes = $this->postJson('/api/v1/conversations/direct', [
            'user_id' => $this->creator->id,
        ]);
        $convRes->assertStatus(201);
        $convId = $convRes->json('data.data.id') ?? $convRes->json('data.id') ?? $convRes->json('id');

        // Member Alice sends first message
        $sendRes = $this->postJson("/api/v1/conversations/{$convId}/messages", [
            'content' => 'Hi Vincent, I want to book a consultation!',
        ]);

        $sendRes->assertStatus(201);
        $sendData = $sendRes->json('data.data') ?? $sendRes->json('data') ?? $sendRes->json();
        
        $this->assertArrayHasKey('automated_message', $sendData);
        $this->assertEquals(
            'Hello! Thanks for reaching out. How can I help you today?',
            $sendData['automated_message']['content']
        );
        $this->assertTrue((bool) $sendData['automated_message']['is_automated']);
        $this->assertEquals($this->creator->id, $sendData['automated_message']['user_id']);

        // Check database messages
        $messages = Message::where('conversation_id', $convId)->orderBy('id')->get();
        $this->assertCount(2, $messages);
        $this->assertEquals('Hi Vincent, I want to book a consultation!', $messages[0]->content);
        $this->assertEquals($this->member->id, $messages[0]->user_id);
        $this->assertFalse((bool) $messages[0]->is_automated);

        $this->assertEquals('Hello! Thanks for reaching out. How can I help you today?', $messages[1]->content);
        $this->assertEquals($this->creator->id, $messages[1]->user_id);
        $this->assertTrue((bool) $messages[1]->is_automated);

        // Verify MessageSent event was broadcast for both Alice's message and the automated greeting
        Event::assertDispatched(MessageSent::class, 2);
    }

    public function test_automated_greeting_does_not_duplicate_on_subsequent_messages(): void
    {
        Event::fake([MessageSent::class]);

        Sanctum::actingAs($this->member);

        $convRes = $this->postJson('/api/v1/conversations/direct', [
            'user_id' => $this->creator->id,
        ]);
        $convId = $convRes->json('data.data.id') ?? $convRes->json('data.id') ?? $convRes->json('id');

        // First message triggers greeting
        $this->postJson("/api/v1/conversations/{$convId}/messages", [
            'content' => 'First message',
        ])->assertStatus(201);

        $this->assertEquals(2, Message::where('conversation_id', $convId)->count());

        // Second message from Alice should NOT trigger another greeting
        $send2Res = $this->postJson("/api/v1/conversations/{$convId}/messages", [
            'content' => 'Second message quickly following up',
        ]);
        $send2Res->assertStatus(201);
        $send2Data = $send2Res->json('data.data') ?? $send2Res->json('data') ?? $send2Res->json();

        $this->assertArrayNotHasKey('automated_message', $send2Data);
        $this->assertEquals(3, Message::where('conversation_id', $convId)->count());
    }

    public function test_chat_settings_can_update_greeting_and_away_messages(): void
    {
        Sanctum::actingAs($this->creator);

        $updateRes = $this->putJson('/api/v1/settings/chat', [
            'greeting_message_enabled' => true,
            'greeting_message' => 'Custom warm greeting for my fans!',
            'away_message_enabled' => true,
            'away_message' => 'Currently recording a new tutorial, be right back.',
        ]);

        $updateRes->assertOk();
        $data = $updateRes->json('data.data') ?? $updateRes->json('data');
        $this->assertTrue((bool) $data['greeting_message_enabled']);
        $this->assertEquals('Custom warm greeting for my fans!', $data['greeting_message']);
        $this->assertTrue((bool) $data['away_message_enabled']);
        $this->assertEquals('Currently recording a new tutorial, be right back.', $data['away_message']);

        // Check show endpoint
        $showRes = $this->getJson('/api/v1/settings/chat');
        $showRes->assertOk();
        $showData = $showRes->json('data.data') ?? $showRes->json('data');
        $this->assertTrue((bool) $showData['greeting_message_enabled']);
        $this->assertEquals('Custom warm greeting for my fans!', $showData['greeting_message']);
    }

    public function test_away_message_is_sent_when_user_is_offline_and_greeting_disabled(): void
    {
        Event::fake([MessageSent::class]);

        $this->creator->update([
            'greeting_message_enabled' => false,
            'away_message_enabled' => true,
            'away_message' => 'I am currently away and will reply shortly.',
            'last_seen_at' => now()->subMinutes(15), // offline
        ]);

        Sanctum::actingAs($this->member);

        $convRes = $this->postJson('/api/v1/conversations/direct', [
            'user_id' => $this->creator->id,
        ]);
        $convId = $convRes->json('data.data.id') ?? $convRes->json('data.id') ?? $convRes->json('id');

        $sendRes = $this->postJson("/api/v1/conversations/{$convId}/messages", [
            'content' => 'Hello Vincent, are you available?',
        ]);

        $sendRes->assertStatus(201);
        $sendData = $sendRes->json('data.data') ?? $sendRes->json('data') ?? $sendRes->json();

        $this->assertArrayHasKey('automated_message', $sendData);
        $this->assertEquals('I am currently away and will reply shortly.', $sendData['automated_message']['content']);
        $this->assertTrue((bool) $sendData['automated_message']['is_automated']);
    }
}
