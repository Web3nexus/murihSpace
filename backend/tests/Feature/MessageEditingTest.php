<?php

namespace Tests\Feature;

use App\Events\MessageEdited;
use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use App\Services\MessageEditingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Editing a chat message is a short, sender-only correction.
 *
 * Every refusal path is asserted here because the client is expected to hide
 * the affordance — the server must not depend on that hiding.
 */
class MessageEditingTest extends TestCase
{
    use RefreshDatabase;

    private User $sender;

    private User $recipient;

    private Conversation $conversation;

    protected function setUp(): void
    {
        parent::setUp();

        config(['murihspace.chat.edit_window_seconds' => 120]);

        $this->sender = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $this->recipient = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);

        $this->conversation = Conversation::create(['type' => 'direct']);
        ConversationParticipant::create(['conversation_id' => $this->conversation->id, 'user_id' => $this->sender->id]);
        ConversationParticipant::create(['conversation_id' => $this->conversation->id, 'user_id' => $this->recipient->id]);
    }

    private function message(array $attributes = []): Message
    {
        return Message::create(array_merge([
            'conversation_id' => $this->conversation->id,
            'user_id' => $this->sender->id,
            'content' => 'Meet me at 6pm',
            'type' => 'text',
            'status' => Message::STATUS_SENT,
        ], $attributes));
    }

    private function editUrl(Message $message): string
    {
        return "/api/v1/conversations/{$this->conversation->id}/messages/{$message->id}";
    }

    public function test_sender_can_edit_their_own_message_within_the_window(): void
    {
        Event::fake([MessageEdited::class]);

        $message = $this->message();
        $original = $message->created_at->copy();

        Sanctum::actingAs($this->sender);

        $response = $this->patchJson($this->editUrl($message), ['content' => 'Meet me at 7pm']);

        $response->assertOk();
        $response->assertJsonPath('data.data.content', 'Meet me at 7pm');

        $this->assertDatabaseHas('messages', [
            'id' => $message->id,
            'content' => 'Meet me at 7pm',
        ]);

        $edited = $message->fresh();
        $this->assertNotNull($edited->edited_at);
        $this->assertSame(1, (int) $edited->edit_count);
        // The window is measured from when the message was sent, not from the
        // moment of the edit.
        $this->assertTrue($edited->edited_at->greaterThanOrEqualTo($original));

        Event::assertDispatched(MessageEdited::class);
    }

    public function test_previous_content_is_retained_for_audit(): void
    {
        $message = $this->message();

        Sanctum::actingAs($this->sender);

        $this->patchJson($this->editUrl($message), ['content' => 'Meet me at 7pm'])->assertOk();
        $this->patchJson($this->editUrl($message), ['content' => 'Meet me at 8pm'])->assertOk();

        // The original wording survives two revisions.
        $this->assertDatabaseHas('message_edits', [
            'message_id' => $message->id,
            'previous_content' => 'Meet me at 6pm',
            'content' => 'Meet me at 7pm',
            'editor_id' => $this->sender->id,
        ]);

        $this->assertDatabaseHas('message_edits', [
            'message_id' => $message->id,
            'previous_content' => 'Meet me at 7pm',
            'content' => 'Meet me at 8pm',
        ]);

        $this->assertSame(2, (int) $message->fresh()->edit_count);
        $this->assertCount(2, $message->fresh()->edits);
    }

    public function test_audit_archive_reports_the_edit_history(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'email_verified_at' => now()]);

        $message = $this->message();

        Sanctum::actingAs($this->sender);
        $this->patchJson($this->editUrl($message), ['content' => 'Meet me at 7pm'])->assertOk();

        Sanctum::actingAs($admin);
        $response = $this->getJson("/api/v1/conversations/{$this->conversation->id}/audit-archive");

        $response->assertOk();
        $response->assertJsonPath('data.messages.0.content', 'Meet me at 7pm');
        $response->assertJsonPath('data.messages.0.edit_count', 1);
        $response->assertJsonPath('data.messages.0.edit_history.0.previous_content', 'Meet me at 6pm');
        $response->assertJsonPath('data.messages.0.edit_history.0.content', 'Meet me at 7pm');
    }

    public function test_a_recipient_cannot_edit_someone_elses_message(): void
    {
        $message = $this->message();

        Sanctum::actingAs($this->recipient);

        $response = $this->patchJson($this->editUrl($message), ['content' => 'Hijacked']);

        $response->assertStatus(403);
        $response->assertJsonPath('errors.reason', MessageEditingService::REASON_NOT_OWNER);

        $this->assertDatabaseHas('messages', ['id' => $message->id, 'content' => 'Meet me at 6pm']);
        $this->assertDatabaseMissing('message_edits', ['message_id' => $message->id]);
    }

    public function test_not_even_a_platform_admin_may_edit_another_users_message(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'email_verified_at' => now()]);

        $message = $this->message();

        Sanctum::actingAs($admin);
        $this->patchJson($this->editUrl($message), ['content' => 'Rewritten by admin'])->assertStatus(403);

        $this->assertDatabaseHas('messages', ['id' => $message->id, 'content' => 'Meet me at 6pm']);
    }

    public function test_a_community_moderator_may_not_edit_another_users_message(): void
    {
        $community = Community::create(['name' => 'Studio', 'slug' => 'studio', 'user_id' => $this->recipient->id]);
        CommunityMembership::create([
            'community_id' => $community->id,
            'user_id' => $this->recipient->id,
            'role' => 'moderator',
        ]);

        $message = $this->message();

        Sanctum::actingAs($this->recipient);
        $this->patchJson($this->editUrl($message), ['content' => 'Moderator edit'])->assertStatus(403);

        $this->assertDatabaseHas('messages', ['id' => $message->id, 'content' => 'Meet me at 6pm']);
    }

    public function test_editing_expires_once_the_window_has_passed(): void
    {
        $message = $this->message();

        Sanctum::actingAs($this->sender);

        // One second inside the window still works.
        $this->travel(119)->seconds();
        $this->patchJson($this->editUrl($message), ['content' => 'Almost too late'])->assertOk();

        // Past the window the original text is frozen.
        $this->travel(5)->minutes();
        $response = $this->patchJson($this->editUrl($message), ['content' => 'Too late']);

        $response->assertStatus(410);
        $response->assertJsonPath('errors.reason', MessageEditingService::REASON_WINDOW_CLOSED);

        $this->assertDatabaseHas('messages', ['id' => $message->id, 'content' => 'Almost too late']);
        $this->assertSame(1, (int) $message->fresh()->edit_count);
    }

    public function test_the_window_is_measured_from_the_original_send_not_the_last_edit(): void
    {
        $message = $this->message();

        Sanctum::actingAs($this->sender);

        // Two edits 60s apart must not extend the total window to 240s.
        $this->travel(60)->seconds();
        $this->patchJson($this->editUrl($message), ['content' => 'Second try'])->assertOk();

        $this->travel(61)->seconds();
        $this->patchJson($this->editUrl($message), ['content' => 'Third try'])->assertStatus(410);

        $this->assertDatabaseHas('messages', ['id' => $message->id, 'content' => 'Second try']);
    }

    public function test_the_window_length_is_configurable(): void
    {
        config(['murihspace.chat.edit_window_seconds' => 30]);

        $message = $this->message();

        Sanctum::actingAs($this->sender);

        $this->travel(31)->seconds();
        $this->patchJson($this->editUrl($message), ['content' => 'Slightly too late'])->assertStatus(410);

        $this->assertDatabaseHas('messages', ['id' => $message->id, 'content' => 'Meet me at 6pm']);
    }

    public function test_editing_can_be_disabled_platform_wide(): void
    {
        config(['murihspace.chat.edit_window_seconds' => 0]);

        $message = $this->message();

        Sanctum::actingAs($this->sender);

        $response = $this->patchJson($this->editUrl($message), ['content' => 'Never allowed']);

        $response->assertStatus(410);
        $response->assertJsonPath('errors.reason', MessageEditingService::REASON_WINDOW_DISABLED);
        $this->assertDatabaseHas('messages', ['id' => $message->id, 'content' => 'Meet me at 6pm']);
    }

    public function test_resubmitting_identical_content_is_not_an_edit(): void
    {
        $message = $this->message();

        Sanctum::actingAs($this->sender);

        $response = $this->patchJson($this->editUrl($message), ['content' => 'Meet me at 6pm']);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.reason', MessageEditingService::REASON_UNCHANGED);

        $this->assertNull($message->fresh()->edited_at);
        $this->assertSame(0, (int) $message->fresh()->edit_count);
        $this->assertDatabaseMissing('message_edits', ['message_id' => $message->id]);
    }

    public function test_a_deleted_message_cannot_be_edited(): void
    {
        $message = $this->message();

        Sanctum::actingAs($this->sender);

        $this->patchJson($this->editUrl($message), ['content' => 'Goodbye'])->assertOk();
        $this->deleteJson($this->editUrl($message), ['mode' => 'everyone'])->assertOk();

        $response = $this->patchJson($this->editUrl($message), ['content' => 'Back from the dead']);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.reason', MessageEditingService::REASON_DELETED);
        $this->assertDatabaseHas('messages', ['id' => $message->id, 'content' => '']);
    }

    public function test_automated_messages_cannot_be_edited(): void
    {
        $message = $this->message(['is_automated' => true]);

        Sanctum::actingAs($this->sender);

        $response = $this->patchJson($this->editUrl($message), ['content' => 'Personalised']);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.reason', MessageEditingService::REASON_AUTOMATED);
    }

    public function test_content_is_required_and_length_limited(): void
    {
        $message = $this->message();

        Sanctum::actingAs($this->sender);

        $this->patchJson($this->editUrl($message), [])->assertStatus(422);
        $this->patchJson($this->editUrl($message), ['content' => ''])->assertStatus(422);
        $this->patchJson($this->editUrl($message), ['content' => str_repeat('a', 5001)])->assertStatus(422);

        $this->assertDatabaseHas('messages', ['id' => $message->id, 'content' => 'Meet me at 6pm']);
    }

    public function test_a_non_participant_cannot_edit(): void
    {
        $outsider = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $message = $this->message();

        Sanctum::actingAs($outsider);

        $this->patchJson($this->editUrl($message), ['content' => 'Intruding'])->assertStatus(403);

        $this->assertDatabaseHas('messages', ['id' => $message->id, 'content' => 'Meet me at 6pm']);
    }

    public function test_the_listing_tells_the_sender_when_the_window_is_open(): void
    {
        $message = $this->message();

        Sanctum::actingAs($this->sender);

        $response = $this->getJson("/api/v1/conversations/{$this->conversation->id}/messages");

        $response->assertOk();
        $response->assertJsonPath('data.data.0.can_edit', true);
        $response->assertJsonPath('data.data.0.edited_at', null);
        $this->assertNotNull($response->json('data.data.0.edit_deadline_at'));
    }

    public function test_the_listing_tells_the_recipient_they_cannot_edit(): void
    {
        $message = $this->message();

        Sanctum::actingAs($this->recipient);

        $response = $this->getJson("/api/v1/conversations/{$this->conversation->id}/messages");

        $response->assertOk();
        $response->assertJsonPath('data.data.0.can_edit', false);
    }

    public function test_the_listing_stops_offering_an_edit_after_the_window_closes(): void
    {
        $message = $this->message();

        Sanctum::actingAs($this->sender);

        $this->travel(121)->seconds();

        $response = $this->getJson("/api/v1/conversations/{$this->conversation->id}/messages");

        $response->assertOk();
        $response->assertJsonPath('data.data.0.can_edit', false);
    }

    public function test_an_edited_message_is_flagged_for_recipients(): void
    {
        $message = $this->message();

        Sanctum::actingAs($this->sender);
        $this->patchJson($this->editUrl($message), ['content' => 'Meet me at 7pm'])->assertOk();

        Sanctum::actingAs($this->recipient);

        $response = $this->getJson("/api/v1/conversations/{$this->conversation->id}/messages");

        $response->assertOk();
        $response->assertJsonPath('data.data.0.content', 'Meet me at 7pm');
        $response->assertJsonPath('data.data.0.edit_count', 1);
        $this->assertNotNull($response->json('data.data.0.edited_at'));
        $response->assertJsonPath('data.data.0.can_edit', false);
    }
}