<?php

namespace Tests\Feature;

use App\Models\AdminSetting;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\ConversationUserSetting;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ConversationPinTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
    }

    private function makeConversation(bool $withMessage = false): Conversation
    {
        $conv = Conversation::create(['type' => 'direct']);
        ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $this->user->id]);

        if ($withMessage) {
            $other = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
            ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $other->id]);
            Message::create([
                'conversation_id' => $conv->id,
                'user_id' => $other->id,
                'content' => 'hello',
                'type' => 'text',
            ]);
        }

        return $conv;
    }

    public function test_user_can_pin_and_unpin_a_conversation(): void
    {
        Sanctum::actingAs($this->user);
        $conv = $this->makeConversation();

        $this->putJson("/api/v1/conversations/{$conv->id}/settings", ['is_pinned' => true])->assertOk();

        $this->assertNotNull(
            ConversationUserSetting::where('conversation_id', $conv->id)
                ->where('user_id', $this->user->id)
                ->value('pinned_at')
        );

        $this->putJson("/api/v1/conversations/{$conv->id}/settings", ['is_pinned' => false])->assertOk();

        $this->assertNull(
            ConversationUserSetting::where('conversation_id', $conv->id)
                ->where('user_id', $this->user->id)
                ->value('pinned_at')
        );
    }

    public function test_pinned_chats_are_capped_and_index_shows_limit(): void
    {
        Sanctum::actingAs($this->user);

        // Pin exactly up to the admin limit (default 3) — all succeed.
        foreach (range(1, 3) as $i) {
            $this->putJson("/api/v1/conversations/{$this->makeConversation()->id}/settings", ['is_pinned' => true])->assertOk();
        }

        $maxPinned = (int) AdminSetting::get('max_pinned_chats', 3);

        $pinnedCount = ConversationUserSetting::where('user_id', $this->user->id)
            ->whereNotNull('pinned_at')
            ->count();

        $this->assertSame($maxPinned, $pinnedCount);

        $denied = $this->putJson("/api/v1/conversations/{$this->makeConversation()->id}/settings", ['is_pinned' => true]);
        $denied->assertStatus(422);
    }

    public function test_index_returns_is_pinned_and_sorts_pinned_first(): void
    {
        Sanctum::actingAs($this->user);

        [$oldConv, $newConv, $pinConv] = [$this->makeConversation(), $this->makeConversation(), $this->makeConversation()];

        $pinConv->touch('updated_at');
        $newConv->touch('updated_at');
        $oldConv->touch('updated_at');

        $this->putJson("/api/v1/conversations/{$pinConv->id}/settings", ['is_pinned' => true])->assertOk();

        $response = $this->getJson('/api/v1/conversations');
        $response->assertOk();
        $response->assertJsonPath('data.0.id', $pinConv->id);
        $response->assertJsonPath('data.0.is_pinned', true);
    }

    public function test_admin_can_update_pin_limit(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'email_verified_at' => now()]);
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/conversations/pin-config', ['max_pinned_chats' => 5])->assertOk();

        $this->assertSame('5', AdminSetting::get('max_pinned_chats'));
        $this->assertSame(5, (int) AdminSetting::get('max_pinned_chats', 3));

        $this->getJson('/api/v1/chat/config')->assertOk()->assertJsonPath('data.max_pinned_chats', 5);
    }

    public function test_unread_count_endpoint(): void
    {
        Sanctum::actingAs($this->user);
        $this->makeConversation(true);

        $this->getJson('/api/v1/messages/unread-count')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 1);
    }
}