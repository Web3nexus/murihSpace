<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Media;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChatMessageDeletionTest extends TestCase
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

    public function test_sender_can_delete_message_for_me(): void
    {
        Sanctum::actingAs($this->sender);

        $message = Message::create([
            'conversation_id' => $this->conversation->id,
            'user_id' => $this->sender->id,
            'content' => 'Hello',
            'type' => 'text',
        ]);

        $response = $this->deleteJson("/api/v1/conversations/{$this->conversation->id}/messages/{$message->id}", [
            'mode' => 'me',
        ]);

        $response->assertOk();
        $response->assertJson(['message' => 'Message hidden.']);

        $this->assertDatabaseHas('message_user_states', [
            'message_id' => $message->id,
            'user_id' => $this->sender->id,
            'is_hidden' => true,
        ]);

        $this->assertDatabaseHas('messages', ['id' => $message->id, 'content' => 'Hello']);
    }

    public function test_hidden_message_not_returned_for_hiding_user(): void
    {
        Sanctum::actingAs($this->sender);

        $message = Message::create([
            'conversation_id' => $this->conversation->id,
            'user_id' => $this->recipient->id,
            'content' => 'Visible to all',
            'type' => 'text',
        ]);

        \App\Models\MessageUserState::create([
            'message_id' => $message->id,
            'user_id' => $this->sender->id,
            'is_hidden' => true,
        ]);

        $response = $this->getJson("/api/v1/conversations/{$this->conversation->id}/messages");
        $response->assertOk();
        $response->assertJsonMissing(['content' => 'Visible to all']);

        Sanctum::actingAs($this->recipient);
        $response2 = $this->getJson("/api/v1/conversations/{$this->conversation->id}/messages");
        $response2->assertOk();
        $response2->assertSee('Visible to all');
    }

    public function test_sender_can_delete_message_for_everyone(): void
    {
        Sanctum::actingAs($this->sender);

        $message = Message::create([
            'conversation_id' => $this->conversation->id,
            'user_id' => $this->sender->id,
            'content' => 'Delete this',
            'type' => 'text',
        ]);

        $response = $this->deleteJson("/api/v1/conversations/{$this->conversation->id}/messages/{$message->id}", [
            'mode' => 'everyone',
        ]);

        $response->assertOk();
        $response->assertJson(['message' => 'Message deleted for everyone.']);

        $this->assertSoftDeleted('messages', ['id' => $message->id]);
    }

    public function test_non_moderator_cannot_delete_others_message_for_everyone(): void
    {
        Sanctum::actingAs($this->recipient);

        $message = Message::create([
            'conversation_id' => $this->conversation->id,
            'user_id' => $this->sender->id,
            'content' => 'Not yours to delete',
            'type' => 'text',
        ]);

        $response = $this->deleteJson("/api/v1/conversations/{$this->conversation->id}/messages/{$message->id}", [
            'mode' => 'everyone',
        ]);

        $response->assertForbidden();
    }

    public function test_moderator_can_delete_for_everyone_in_community(): void
    {
        $community = Community::factory()->create(['user_id' => $this->sender->id]);
        CommunityMembership::create([
            'community_id' => $community->id,
            'user_id' => $this->recipient->id,
            'role' => 'moderator',
            'status' => 'active',
        ]);

        $conv = Conversation::create(['type' => 'community', 'community_id' => $community->id]);

        Sanctum::actingAs($this->sender);
        $message = Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $this->sender->id,
            'content' => 'Moderated content',
            'type' => 'text',
        ]);

        Sanctum::actingAs($this->recipient);
        $response = $this->deleteJson("/api/v1/conversations/{$conv->id}/messages/{$message->id}", [
            'mode' => 'everyone',
        ]);

        $response->assertOk();
        $this->assertSoftDeleted('messages', ['id' => $message->id]);
    }

    public function test_delete_for_everyone_clears_media_reference(): void
    {
        Sanctum::actingAs($this->sender);

        $media = Media::create([
            'user_id' => $this->sender->id,
            'disk' => 'local_uploads',
            'folder' => 'message_attachments',
            'filename' => 'test.jpg',
            'original_name' => 'test.jpg',
            'path' => 'message_attachments/test.jpg',
            'url' => '/storage/uploads/message_attachments/test.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 1024,
        ]);

        $message = Message::create([
            'conversation_id' => $this->conversation->id,
            'user_id' => $this->sender->id,
            'type' => 'image',
            'content' => '',
            'media_id' => $media->id,
            'attachment_url' => $media->url,
            'attachment_type' => 'image',
        ]);
        $media->incrementReferenceCount();
        $this->assertEquals(1, $media->fresh()->reference_count);

        $response = $this->deleteJson("/api/v1/conversations/{$this->conversation->id}/messages/{$message->id}", [
            'mode' => 'everyone',
        ]);

        $response->assertOk();
        $this->assertEquals(0, $media->fresh()->reference_count);
    }
}
