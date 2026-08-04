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
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChatMediaAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_can_access_community_chat_media(): void
    {
        $member = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $community = Community::factory()->create();

        CommunityMembership::create([
            'community_id' => $community->id,
            'user_id' => $member->id,
            'role' => 'member',
            'status' => 'active',
        ]);

        $conv = Conversation::create(['type' => 'community', 'community_id' => $community->id]);
        ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $member->id]);

        $media = Media::create([
            'user_id' => $member->id,
            'disk' => 'local_uploads',
            'folder' => 'message_attachments',
            'filename' => 'test.jpg',
            'original_name' => 'test.jpg',
            'path' => 'message_attachments/test.jpg',
            'url' => '/storage/uploads/message_attachments/test.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 1024,
        ]);

        Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $member->id,
            'content' => 'Check image',
            'type' => 'image',
            'status' => 'sent',
            'media_id' => $media->id,
            'attachment_url' => $media->url,
            'attachment_type' => 'image',
        ]);

        \Illuminate\Support\Facades\Storage::fake('local_uploads');
        \Illuminate\Support\Facades\Storage::disk('local_uploads')->put('message_attachments/test.jpg', 'dummy image content');

        Sanctum::actingAs($member);
        $response = $this->getJson("/api/v1/chat/media/{$media->id}");
        $response->assertOk();
        $response->assertJsonPath('data.data.original_name', 'test.jpg');
    }

    public function test_non_member_cannot_access_community_chat_media(): void
    {
        $member = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $nonMember = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $community = Community::factory()->create();

        CommunityMembership::create([
            'community_id' => $community->id,
            'user_id' => $member->id,
            'role' => 'member',
            'status' => 'active',
        ]);

        $conv = Conversation::create(['type' => 'community', 'community_id' => $community->id]);
        ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $member->id]);

        $media = Media::create([
            'user_id' => $member->id,
            'disk' => 'local_uploads',
            'folder' => 'message_attachments',
            'filename' => 'test.jpg',
            'original_name' => 'test.jpg',
            'path' => 'message_attachments/test.jpg',
            'url' => '/storage/uploads/message_attachments/test.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 1024,
        ]);

        Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $member->id,
            'content' => 'Private',
            'type' => 'image',
            'media_id' => $media->id,
            'attachment_url' => $media->url,
            'attachment_type' => 'image',
        ]);

        Sanctum::actingAs($nonMember);
        $response = $this->getJson("/api/v1/chat/media/{$media->id}");
        $response->assertForbidden();
    }

    public function test_banned_user_cannot_access_community_chat_media(): void
    {
        $member = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $banned = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $community = Community::factory()->create();

        CommunityMembership::create([
            'community_id' => $community->id,
            'user_id' => $member->id,
            'role' => 'member',
            'status' => 'active',
        ]);

        CommunityMembership::create([
            'community_id' => $community->id,
            'user_id' => $banned->id,
            'role' => 'member',
            'status' => 'banned',
        ]);

        $conv = Conversation::create(['type' => 'community', 'community_id' => $community->id]);
        ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $member->id]);

        $media = Media::create([
            'user_id' => $member->id,
            'disk' => 'local_uploads',
            'folder' => 'message_attachments',
            'filename' => 'test.jpg',
            'original_name' => 'test.jpg',
            'path' => 'message_attachments/test.jpg',
            'url' => '/storage/uploads/message_attachments/test.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 1024,
        ]);

        Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $member->id,
            'content' => 'Banned user test',
            'type' => 'image',
            'media_id' => $media->id,
            'attachment_url' => $media->url,
            'attachment_type' => 'image',
        ]);

        Sanctum::actingAs($banned);
        $response = $this->getJson("/api/v1/chat/media/{$media->id}");
        $response->assertForbidden();
    }

    public function test_deleted_message_media_not_returned(): void
    {
        $member = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);
        $community = Community::factory()->create();

        CommunityMembership::create([
            'community_id' => $community->id,
            'user_id' => $member->id,
            'role' => 'member',
            'status' => 'active',
        ]);

        $conv = Conversation::create(['type' => 'community', 'community_id' => $community->id]);
        ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $member->id]);

        $media = Media::create([
            'user_id' => $member->id,
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
            'conversation_id' => $conv->id,
            'user_id' => $member->id,
            'content' => 'Deleted message',
            'type' => 'image',
            'media_id' => $media->id,
            'attachment_url' => $media->url,
            'attachment_type' => 'image',
        ]);

        $message->delete();

        Sanctum::actingAs($member);
        $response = $this->getJson("/api/v1/chat/media/{$media->id}");
        $response->assertStatus(404);
    }
}
