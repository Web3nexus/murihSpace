<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ConversationReadAllTest extends TestCase
{
    use RefreshDatabase;

    public function test_read_all_marks_every_conversation_of_the_user_as_read(): void
    {
        $me = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $other = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);

        $chats = [];
        foreach (range(1, 2) as $_) {
            $chat = Conversation::create(['type' => 'direct']);
            ConversationParticipant::create(['conversation_id' => $chat->id, 'user_id' => $me->id, 'last_read_at' => null]);
            ConversationParticipant::create(['conversation_id' => $chat->id, 'user_id' => $other->id]);
            $chats[] = $chat;
        }

        Sanctum::actingAs($me);
        $this->postJson('/api/v1/conversations/read-all')->assertOk();

        foreach ($chats as $chat) {
            $this->assertNotNull(ConversationParticipant::where('conversation_id', $chat->id)
                ->where('user_id', $me->id)->value('last_read_at'));
        }

        // The other person's read state is untouched.
        $this->assertNull(ConversationParticipant::where('conversation_id', $chats[0]->id)
            ->where('user_id', $other->id)->value('last_read_at'));
    }
}
