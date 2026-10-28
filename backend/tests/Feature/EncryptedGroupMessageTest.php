<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\E2eeSenderKeyEnvelope;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EncryptedGroupMessageTest extends TestCase
{
    use RefreshDatabase;

    private User $alice;

    private User $bob;

    private User $carol;

    private Conversation $group;

    protected function setUp(): void
    {
        parent::setUp();

        $this->alice = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $this->bob = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $this->carol = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);

        $this->group = Conversation::create(['type' => 'group', 'title' => 'Friends']);
        foreach ([$this->alice, $this->bob, $this->carol] as $member) {
            ConversationParticipant::create(['conversation_id' => $this->group->id, 'user_id' => $member->id]);
        }
    }

    /** The epoch is server-managed (E2eeGroupService), so tests set it directly. */
    private function setEpoch(int $epoch): void
    {
        $this->group->forceFill(['e2ee_epoch' => $epoch])->save();
    }

    private function send(User $as, array $payload)
    {
        Sanctum::actingAs($as);

        return $this->postJson("/api/v1/conversations/{$this->group->id}/messages", $payload);
    }

    private function groupMessage(User $as, int $epoch, ?string $ciphertext = null)
    {
        return $this->send($as, [
            'ciphertext' => $ciphertext ?? base64_encode(random_bytes(48)),
            'encryption' => 'signal_group_v1',
            'key_epoch' => $epoch,
        ]);
    }

    /** Sender key envelopes from $sender to every other member, for the group's current epoch. */
    private function distribute(User $sender, array $recipients, ?int $epoch = null)
    {
        Sanctum::actingAs($sender);

        return $this->postJson("/api/v1/conversations/{$this->group->id}/sender-keys", [
            'epoch' => $epoch ?? $this->group->fresh()->e2ee_epoch,
            'envelopes' => collect($recipients)->map(fn (User $user) => [
                'recipient_user_id' => $user->id,
                'ciphertext' => base64_encode("envelope for {$user->id}"),
            ])->values()->all(),
        ]);
    }

    public function test_group_message_is_stored_as_one_ciphertext_tagged_with_its_epoch(): void
    {
        $ciphertext = base64_encode(random_bytes(64));

        $this->groupMessage($this->alice, 0, $ciphertext)->assertSuccessful();

        $row = Message::latest('id')->first();
        $this->assertSame('signal_group_v1', $row->encryption);
        $this->assertSame($ciphertext, $row->ciphertext);
        $this->assertSame(0, $row->key_epoch);
        $this->assertSame('', $row->content);
    }

    public function test_group_message_needs_its_key_epoch(): void
    {
        $this->send($this->alice, [
            'ciphertext' => base64_encode('x'),
            'encryption' => 'signal_group_v1',
        ])->assertStatus(422);

        $this->assertSame(0, Message::count());
    }

    public function test_group_message_with_a_stale_epoch_is_refused(): void
    {
        $this->setEpoch(2);

        $this->groupMessage($this->alice, 1)
            ->assertStatus(409)
            ->assertJsonPath('errors.code', 'STALE_KEY_EPOCH')
            ->assertJsonPath('errors.epoch', 2);

        $this->assertSame(0, Message::count());
    }

    public function test_pairwise_encryption_is_refused_in_a_group(): void
    {
        $this->send($this->alice, ['ciphertext' => base64_encode('x'), 'encryption' => 'signal_v1'])
            ->assertStatus(422);

        $this->assertSame(0, Message::count());
    }

    public function test_group_encryption_is_refused_in_a_direct_chat(): void
    {
        $direct = Conversation::create(['type' => 'direct']);
        ConversationParticipant::create(['conversation_id' => $direct->id, 'user_id' => $this->alice->id]);
        ConversationParticipant::create(['conversation_id' => $direct->id, 'user_id' => $this->bob->id]);

        Sanctum::actingAs($this->alice);
        $this->postJson("/api/v1/conversations/{$direct->id}/messages", [
            'ciphertext' => base64_encode('x'),
            'encryption' => 'signal_group_v1',
            'key_epoch' => 0,
        ])->assertStatus(422);

        $this->assertSame(0, Message::count());
    }

    public function test_key_epoch_without_group_encryption_is_refused(): void
    {
        $this->send($this->alice, ['content' => 'hello', 'key_epoch' => 0])->assertStatus(422);

        $this->assertSame(0, Message::count());
    }

    public function test_group_encrypted_message_cannot_carry_plaintext(): void
    {
        $this->send($this->alice, [
            'content' => 'leak',
            'ciphertext' => base64_encode('x'),
            'encryption' => 'signal_group_v1',
            'key_epoch' => 0,
        ])->assertStatus(422);

        $this->assertSame(0, Message::count());
    }

    public function test_members_receive_the_distribution_addressed_to_them_only(): void
    {
        $this->distribute($this->alice, [$this->bob, $this->carol])->assertStatus(201);

        Sanctum::actingAs($this->bob);
        $bobsEnvelopes = $this->getJson("/api/v1/conversations/{$this->group->id}/sender-keys")
            ->assertOk()
            ->assertJsonPath('data.epoch', 0)
            ->json('data.envelopes');

        $this->assertCount(1, $bobsEnvelopes);
        $this->assertSame($this->alice->id, $bobsEnvelopes[0]['sender_user_id']);
        $this->assertSame(base64_encode("envelope for {$this->bob->id}"), $bobsEnvelopes[0]['ciphertext']);
    }

    public function test_acknowledged_distributions_are_deleted(): void
    {
        $this->distribute($this->alice, [$this->bob, $this->carol])->assertStatus(201);
        $bobsId = E2eeSenderKeyEnvelope::where('recipient_user_id', $this->bob->id)->value('id');

        Sanctum::actingAs($this->bob);
        $this->postJson("/api/v1/conversations/{$this->group->id}/sender-keys/ack", ['ids' => [$bobsId]])
            ->assertOk()
            ->assertJsonPath('data.acknowledged', 1);

        $this->getJson("/api/v1/conversations/{$this->group->id}/sender-keys")
            ->assertJsonCount(0, 'data.envelopes');
        $this->assertSame(1, E2eeSenderKeyEnvelope::count());
    }

    public function test_a_distribution_must_reach_every_other_member(): void
    {
        $this->distribute($this->alice, [$this->bob])->assertStatus(422);

        $this->assertSame(0, E2eeSenderKeyEnvelope::count());
    }

    public function test_a_distribution_for_a_stale_epoch_is_refused(): void
    {
        $this->setEpoch(3);

        $this->distribute($this->alice, [$this->bob, $this->carol], 2)
            ->assertStatus(409)
            ->assertJsonPath('errors.code', 'STALE_KEY_EPOCH');

        $this->assertSame(0, E2eeSenderKeyEnvelope::count());
    }

    public function test_a_sender_key_cannot_be_sent_to_the_sender(): void
    {
        $this->distribute($this->alice, [$this->alice, $this->bob, $this->carol])->assertStatus(422);

        $this->assertSame(0, E2eeSenderKeyEnvelope::count());
    }

    public function test_sender_keys_are_only_for_group_chats(): void
    {
        $direct = Conversation::create(['type' => 'direct']);
        ConversationParticipant::create(['conversation_id' => $direct->id, 'user_id' => $this->alice->id]);

        Sanctum::actingAs($this->alice);
        $this->getJson("/api/v1/conversations/{$direct->id}/sender-keys")->assertStatus(422);
    }

    public function test_leaving_the_group_rotates_the_epoch_and_drops_old_distributions(): void
    {
        $this->distribute($this->alice, [$this->bob, $this->carol])->assertStatus(201);
        $this->distribute($this->bob, [$this->alice, $this->carol])->assertStatus(201);
        $this->groupMessage($this->alice, 0)->assertSuccessful();

        $owner = $this->alice;
        $groupRecord = Group::create([
            'name' => 'Friends',
            'slug' => 'friends-'.uniqid(),
            'creator_id' => $owner->id,
            'members_count' => 3,
        ]);
        $this->group->update(['type' => 'group', 'group_id' => $groupRecord->id]);
        GroupMember::create(['group_id' => $groupRecord->id, 'user_id' => $owner->id, 'role' => 'owner', 'status' => 'active']);
        GroupMember::create(['group_id' => $groupRecord->id, 'user_id' => $this->bob->id, 'role' => 'admin', 'status' => 'active']);
        GroupMember::create(['group_id' => $groupRecord->id, 'user_id' => $this->carol->id, 'role' => 'member', 'status' => 'active']);

        Sanctum::actingAs($this->carol);
        $this->postJson("/api/v1/groups/{$groupRecord->id}/leave")->assertOk();

        $this->assertSame(1, $this->group->fresh()->e2ee_epoch);
        $this->assertSame(0, E2eeSenderKeyEnvelope::count());

        // Alice still holds the epoch-0 key, which is no longer accepted.
        $this->groupMessage($this->alice, 0)->assertStatus(409)->assertJsonPath('errors.code', 'STALE_KEY_EPOCH');

        // A removed member cannot read or write the group any more.
        Sanctum::actingAs($this->carol);
        $this->getJson("/api/v1/conversations/{$this->group->id}/sender-keys")->assertStatus(403);
    }

    public function test_the_message_list_reports_the_current_epoch(): void
    {
        $this->setEpoch(4);
        Sanctum::actingAs($this->alice);

        $this->getJson("/api/v1/conversations/{$this->group->id}/messages")
            ->assertOk()
            ->assertJsonPath('data.e2ee_epoch', 4);
    }

    public function test_an_encrypted_message_cannot_be_edited_into_plaintext(): void
    {
        $this->groupMessage($this->alice, 0)->assertSuccessful();
        $message = Message::latest('id')->first();

        Sanctum::actingAs($this->alice);
        $this->patchJson("/api/v1/conversations/{$this->group->id}/messages/{$message->id}", ['content' => 'now readable'])
            ->assertStatus(422);

        $this->assertSame('', $message->fresh()->content);
    }

    public function test_an_encrypted_message_cannot_be_forwarded(): void
    {
        $this->groupMessage($this->alice, 0)->assertSuccessful();
        $message = Message::latest('id')->first();

        $target = Conversation::create(['type' => 'direct']);
        ConversationParticipant::create(['conversation_id' => $target->id, 'user_id' => $this->alice->id]);

        Sanctum::actingAs($this->alice);
        $this->postJson("/api/v1/messages/{$message->id}/forward", ['to_conversation_id' => $target->id])
            ->assertStatus(422);

        $this->assertSame(1, Message::count());
    }
}
