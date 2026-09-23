<?php

namespace Tests\Feature;

use App\Models\BroadcastChannel;
use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\FriendRequest;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BroadcastChannelTest extends TestCase
{
    use RefreshDatabase;

    private User $creator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->creator = User::factory()->create(['role' => 'creator', 'email_verified_at' => now()]);
    }

    public function test_creator_can_create_channel_linked_to_their_page(): void
    {
        Sanctum::actingAs($this->creator);

        $friend = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $follower = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);

        FriendRequest::create([
            'sender_id' => $this->creator->id,
            'receiver_id' => $friend->id,
            'status' => FriendRequest::STATUS_ACCEPTED,
        ]);

        $this->creator->followers()->attach($follower->id);

        $this->postJson('/api/v1/broadcast-channels', [
            'name' => 'Page Broadcast',
            'linked_type' => 'page',
        ])->assertCreated()
            ->assertJsonPath('data.recipients_count', 2);

        $this->assertDatabaseHas('broadcast_channel_members', [
            'user_id' => $friend->id,
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('broadcast_channel_members', [
            'user_id' => $follower->id,
            'status' => 'active',
        ]);
    }

    public function test_creator_can_create_channel_linked_to_owned_group(): void
    {
        Sanctum::actingAs($this->creator);

        $member = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);

        $group = Group::create([
            'name' => 'My Signals Group',
            'slug' => 'my-signals-group',
            'creator_id' => $this->creator->id,
            'members_count' => 2,
        ]);

        GroupMember::create([
            'group_id' => $group->id,
            'user_id' => $member->id,
            'role' => 'member',
            'status' => 'active',
        ]);

        $this->postJson('/api/v1/broadcast-channels', [
            'name' => 'Group Broadcast',
            'linked_type' => 'group',
            'linked_id' => $group->id,
        ])->assertCreated()
            ->assertJsonPath('data.linked_id', $group->id)
            ->assertJsonPath('data.recipients_count', 1);

        $this->assertDatabaseHas('broadcast_channel_members', [
            'user_id' => $member->id,
            'status' => 'active',
        ]);
    }

    public function test_creator_cannot_link_to_group_they_do_not_own(): void
    {
        Sanctum::actingAs($this->creator);

        $otherOwner = User::factory()->create(['role' => 'creator', 'email_verified_at' => now()]);

        $otherGroup = Group::create([
            'name' => 'Someone Elses Group',
            'slug' => 'someone-else-group',
            'creator_id' => $otherOwner->id,
            'members_count' => 1,
        ]);

        GroupMember::create([
            'group_id' => $otherGroup->id,
            'user_id' => $otherOwner->id,
            'role' => 'owner',
            'status' => 'active',
        ]);

        $this->postJson('/api/v1/broadcast-channels', [
            'name' => 'Sneaky Broadcast',
            'linked_type' => 'group',
            'linked_id' => $otherGroup->id,
        ])->assertForbidden();

        $this->assertDatabaseCount('broadcast_channel_members', 0);
    }

    public function test_creator_can_link_to_owned_community_members(): void
    {
        Sanctum::actingAs($this->creator);

        $member = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);

        $community = Community::create([
            'user_id' => $this->creator->id,
            'name' => 'My Community',
            'slug' => 'my-community',
            'visibility' => 'public',
            'members_count' => 2,
        ]);

        CommunityMembership::create([
            'community_id' => $community->id,
            'user_id' => $member->id,
            'role' => 'member',
            'status' => 'active',
        ]);

        $this->postJson('/api/v1/broadcast-channels', [
            'name' => 'Community Broadcast',
            'linked_type' => 'community',
            'linked_id' => $community->id,
        ])->assertCreated()
            ->assertJsonPath('data.recipients_count', 1);
    }

    public function test_creator_cannot_link_to_community_they_do_not_own(): void
    {
        Sanctum::actingAs($this->creator);

        $otherOwner = User::factory()->create(['role' => 'creator', 'email_verified_at' => now()]);

        $otherCommunity = Community::create([
            'user_id' => $otherOwner->id,
            'name' => 'Not Mine',
            'slug' => 'not-mine',
            'visibility' => 'public',
            'members_count' => 1,
        ]);

        $this->postJson('/api/v1/broadcast-channels', [
            'name' => 'Sneaky Broadcast',
            'linked_type' => 'community',
            'linked_id' => $otherCommunity->id,
        ])->assertForbidden();
    }

    public function test_recipient_access_is_lost_when_they_unfollow_the_owner(): void
    {
        Sanctum::actingAs($this->creator);

        $follower = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $this->creator->followers()->attach($follower->id);

        $channel = $this->postJson('/api/v1/broadcast-channels', [
            'name' => 'Follower Broadcast',
            'linked_type' => 'page',
        ])->assertCreated()->json('data');

        $follower->follows()->detach($this->creator->id);

        Sanctum::actingAs($follower);

        $this->getJson("/api/v1/broadcast-channels/{$channel['id']}")->assertNotFound();

        Sanctum::actingAs($this->creator);

        $this->getJson("/api/v1/broadcast-channels/{$channel['id']}/members")->assertOk()
            ->assertJsonPath('data.total', 0);

        $this->assertDatabaseMissing('broadcast_channel_members', [
            'broadcast_channel_id' => $channel['id'],
            'user_id' => $follower->id,
            'status' => 'active',
        ]);
    }

    public function test_unfriended_user_is_dropped_from_the_members_list(): void
    {
        Sanctum::actingAs($this->creator);

        $friend = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        FriendRequest::create([
            'sender_id' => $this->creator->id,
            'receiver_id' => $friend->id,
            'status' => FriendRequest::STATUS_ACCEPTED,
        ]);

        $channel = $this->postJson('/api/v1/broadcast-channels', [
            'name' => 'Friend Broadcast',
            'linked_type' => 'page',
        ])->assertCreated()->json('data');

        FriendRequest::where('sender_id', $this->creator->id)
            ->where('receiver_id', $friend->id)
            ->delete();

        $this->getJson("/api/v1/broadcast-channels/{$channel['id']}/members")->assertOk()
            ->assertJsonPath('data.total', 0);

        $this->assertDatabaseMissing('broadcast_channel_members', [
            'broadcast_channel_id' => $channel['id'],
            'user_id' => $friend->id,
            'status' => 'active',
        ]);
    }

    public function test_new_group_members_are_added_on_sync(): void
    {
        Sanctum::actingAs($this->creator);

        $group = Group::create([
            'name' => 'Growth Group',
            'slug' => 'growth-group',
            'creator_id' => $this->creator->id,
            'members_count' => 1,
        ]);

        GroupMember::create([
            'group_id' => $group->id,
            'user_id' => $this->creator->id,
            'role' => 'owner',
            'status' => 'active',
        ]);

        $channel = $this->postJson('/api/v1/broadcast-channels', [
            'name' => 'Growth Broadcast',
            'linked_type' => 'group',
            'linked_id' => $group->id,
        ])->assertCreated()->json('data');

        $newMember = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        GroupMember::create([
            'group_id' => $group->id,
            'user_id' => $newMember->id,
            'role' => 'member',
            'status' => 'active',
        ]);

        $this->getJson("/api/v1/broadcast-channels/{$channel['id']}/members")->assertOk()
            ->assertJsonPath('data.total', 1);

        $this->assertDatabaseHas('broadcast_channel_members', [
            'broadcast_channel_id' => $channel['id'],
            'user_id' => $newMember->id,
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('broadcast_channels', [
            'id' => $channel['id'],
            'recipients_count' => 1,
        ]);
    }

    public function test_linked_type_is_required(): void
    {
        Sanctum::actingAs($this->creator);

        $this->postJson('/api/v1/broadcast-channels', [
            'name' => 'No Link',
        ])->assertStatus(422);
    }

    public function test_owner_can_see_members_and_delete_channel(): void
    {
        Sanctum::actingAs($this->creator);

        $friend = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        FriendRequest::create([
            'sender_id' => $this->creator->id,
            'receiver_id' => $friend->id,
            'status' => FriendRequest::STATUS_ACCEPTED,
        ]);

        $channel = $this->postJson('/api/v1/broadcast-channels', [
            'name' => 'Page Broadcast 2',
            'linked_type' => 'page',
        ])->assertCreated()->json('data');

        $this->getJson("/api/v1/broadcast-channels/{$channel['id']}/members")->assertOk()
            ->assertJsonPath('data.total', 1);

        $this->deleteJson("/api/v1/broadcast-channels/{$channel['id']}")->assertOk();

        $this->assertDatabaseMissing('broadcast_channels', ['id' => $channel['id']]);
        $this->assertDatabaseCount('broadcast_channel_members', 0);
    }

    public function test_recipient_cannot_manage_or_delete_channel(): void
    {
        Sanctum::actingAs($this->creator);

        $recipient = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        FriendRequest::create([
            'sender_id' => $this->creator->id,
            'receiver_id' => $recipient->id,
            'status' => FriendRequest::STATUS_ACCEPTED,
        ]);

        $channel = $this->postJson('/api/v1/broadcast-channels', [
            'name' => 'Page Broadcast 3',
            'linked_type' => 'page',
        ])->assertCreated()->json('data');

        Sanctum::actingAs($recipient);

        $this->getJson("/api/v1/broadcast-channels/{$channel['id']}/members")->assertNotFound();
        $this->deleteJson("/api/v1/broadcast-channels/{$channel['id']}")->assertNotFound();
    }
}