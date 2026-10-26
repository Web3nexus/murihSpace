<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use App\Notifications\NewMessageNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EncryptedMessageTest extends TestCase
{
    use RefreshDatabase;

    private User $sender;

    private User $recipient;

    private Conversation $conversation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sender = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $this->recipient = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $this->conversation = Conversation::create(['type' => 'direct']);
        ConversationParticipant::create(['conversation_id' => $this->conversation->id, 'user_id' => $this->sender->id]);
        ConversationParticipant::create(['conversation_id' => $this->conversation->id, 'user_id' => $this->recipient->id]);
    }

    private function send(array $payload)
    {
        Sanctum::actingAs($this->sender);

        return $this->postJson("/api/v1/conversations/{$this->conversation->id}/messages", $payload);
    }

    public function test_encrypted_message_is_stored_as_ciphertext_with_no_plaintext(): void
    {
        $ciphertext = base64_encode(random_bytes(64));

        $this->send(['ciphertext' => $ciphertext, 'encryption' => 'signal_v1'])->assertSuccessful();

        $row = Message::latest('id')->first();
        $this->assertSame('signal_v1', $row->encryption);
        $this->assertSame($ciphertext, $row->ciphertext);
        $this->assertSame('', $row->content);
    }

    public function test_plaintext_messages_still_send_normally(): void
    {
        $this->send(['content' => 'hello'])->assertSuccessful();

        $row = Message::latest('id')->first();
        $this->assertSame('hello', $row->content);
        $this->assertNull($row->encryption);
        $this->assertNull($row->ciphertext);
    }

    public function test_encrypted_message_refuses_plaintext_alongside_it(): void
    {
        $this->send([
            'content' => 'leak',
            'ciphertext' => base64_encode('x'),
            'encryption' => 'signal_v1',
        ])->assertStatus(422);

        $this->assertSame(0, Message::count());
    }

    public function test_ciphertext_without_an_encryption_type_is_refused(): void
    {
        $this->send(['ciphertext' => base64_encode('x')])->assertStatus(422);

        $this->assertSame(0, Message::count());
    }

    public function test_encryption_type_without_ciphertext_is_refused(): void
    {
        $this->send(['encryption' => 'signal_v1'])->assertStatus(422);

        $this->assertSame(0, Message::count());
    }

    public function test_encrypted_message_preview_does_not_reveal_text(): void
    {
        $this->send(['ciphertext' => base64_encode('x'), 'encryption' => 'signal_v1'])->assertSuccessful();
        $message = Message::latest('id')->first();

        $data = (new NewMessageNotification($message, $this->conversation, $this->sender))->toDatabase($this->recipient);

        $this->assertSame('New encrypted message', $data['message_preview']);
    }
}
