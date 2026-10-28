<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\EncryptedAttachment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EncryptedAttachmentTest extends TestCase
{
    use RefreshDatabase;

    private const DISK = 'contabo_private';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(self::DISK);
    }

    private function conversationWith(User ...$users): Conversation
    {
        $conv = Conversation::create(['type' => 'direct']);
        foreach ($users as $user) {
            ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $user->id]);
        }

        return $conv;
    }

    private function ciphertext(int $bytes = 2048, string $name = 'a1b2c3.bin'): UploadedFile
    {
        // Random bytes stand in for AES-GCM output. Note the non-media mime and extension.
        return UploadedFile::fake()->createWithContent($name, random_bytes($bytes));
    }

    public function test_participant_can_upload_ciphertext_without_plaintext_mime_checks(): void
    {
        $alice = User::factory()->create(['email_verified_at' => now()]);
        $bob = User::factory()->create(['email_verified_at' => now()]);
        $conv = $this->conversationWith($alice, $bob);

        Sanctum::actingAs($alice);
        $response = $this->postJson('/api/v1/attachments/encrypted', [
            'conversation_id' => $conv->id,
            'file' => $this->ciphertext(4096, 'holiday-photo.jpg'),
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.data.size', 4096);
        $response->assertJsonPath('data.data.content_type', 'application/octet-stream');
        // The upload response never includes a URL, public or otherwise.
        $this->assertArrayNotHasKey('url', $response->json('data.data'));
        $this->assertStringNotContainsString('holiday-photo', json_encode($response->json()));

        $row = EncryptedAttachment::findOrFail($response->json('data.data.id'));
        $this->assertSame($alice->id, $row->user_id);
        $this->assertSame($conv->id, $row->conversation_id);
        $this->assertSame(self::DISK, $row->disk);
        $this->assertSame(4096, $row->size_bytes);
        $this->assertSame('application/octet-stream', $row->content_type);
        $this->assertStringStartsWith('encrypted_attachments/', $row->object_path);
        $this->assertStringNotContainsString('holiday-photo', $row->object_path);
        Storage::disk(self::DISK)->assertExists($row->object_path);
    }

    public function test_size_limit_is_enforced(): void
    {
        config(['encrypted_attachments.max_bytes' => 1024 * 1024]);

        $alice = User::factory()->create(['email_verified_at' => now()]);
        $conv = $this->conversationWith($alice);

        Sanctum::actingAs($alice);
        $response = $this->postJson('/api/v1/attachments/encrypted', [
            'conversation_id' => $conv->id,
            'file' => $this->ciphertext(2 * 1024 * 1024),
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['file']);
        $this->assertSame(0, EncryptedAttachment::count());
    }

    public function test_daily_count_limit_is_enforced(): void
    {
        config(['encrypted_attachments.daily_upload_limit' => 1]);

        $alice = User::factory()->create(['email_verified_at' => now()]);
        $conv = $this->conversationWith($alice);

        Sanctum::actingAs($alice);
        $this->postJson('/api/v1/attachments/encrypted', [
            'conversation_id' => $conv->id,
            'file' => $this->ciphertext(),
        ])->assertCreated();

        $this->postJson('/api/v1/attachments/encrypted', [
            'conversation_id' => $conv->id,
            'file' => $this->ciphertext(),
        ])->assertStatus(429);
    }

    public function test_non_participant_cannot_upload_into_conversation(): void
    {
        $alice = User::factory()->create(['email_verified_at' => now()]);
        $bob = User::factory()->create(['email_verified_at' => now()]);
        $conv = $this->conversationWith($bob);

        Sanctum::actingAs($alice);
        $this->postJson('/api/v1/attachments/encrypted', [
            'conversation_id' => $conv->id,
            'file' => $this->ciphertext(),
        ])->assertStatus(403);

        $this->assertSame(0, EncryptedAttachment::count());
    }

    public function test_participant_gets_short_lived_signed_url_and_no_public_url(): void
    {
        $alice = User::factory()->create(['email_verified_at' => now()]);
        $bob = User::factory()->create(['email_verified_at' => now()]);
        $conv = $this->conversationWith($alice, $bob);

        Sanctum::actingAs($alice);
        $id = $this->postJson('/api/v1/attachments/encrypted', [
            'conversation_id' => $conv->id,
            'file' => $this->ciphertext(),
        ])->assertCreated()->json('data.data.id');

        $row = EncryptedAttachment::findOrFail($id);

        Sanctum::actingAs($bob);
        $response = $this->getJson("/api/v1/attachments/encrypted/{$id}/url");

        $response->assertOk();
        $url = $response->json('data.data.url');
        $this->assertNotEmpty($url);
        // Signed, time-limited, and not the plain object path.
        $this->assertStringContainsString('expiration=', $url);
        $this->assertNotSame(Storage::disk(self::DISK)->url($row->object_path), $url);
        $this->assertSame('application/octet-stream', $response->json('data.data.content_type'));
        $this->assertNotNull($response->json('data.data.expires_at'));
    }

    public function test_non_participant_cannot_get_url_and_gets_no_url(): void
    {
        $alice = User::factory()->create(['email_verified_at' => now()]);
        $bob = User::factory()->create(['email_verified_at' => now()]);
        $mallory = User::factory()->create(['email_verified_at' => now()]);
        $conv = $this->conversationWith($alice, $bob);

        Sanctum::actingAs($alice);
        $id = $this->postJson('/api/v1/attachments/encrypted', [
            'conversation_id' => $conv->id,
            'file' => $this->ciphertext(),
        ])->assertCreated()->json('data.data.id');

        Sanctum::actingAs($mallory);
        $response = $this->getJson("/api/v1/attachments/encrypted/{$id}/url");

        $response->assertStatus(404);
        $this->assertArrayNotHasKey('url', $response->json() ?? []);
        $this->assertStringNotContainsString('signature=', (string) $response->getContent());
    }

    public function test_unknown_attachment_returns_not_found(): void
    {
        $alice = User::factory()->create(['email_verified_at' => now()]);

        Sanctum::actingAs($alice);
        $this->getJson('/api/v1/attachments/encrypted/'.(string) Str::uuid().'/url')
            ->assertStatus(404);
    }

    public function test_endpoints_require_authentication(): void
    {
        $this->postJson('/api/v1/attachments/encrypted', ['conversation_id' => 1, 'file' => $this->ciphertext()])
            ->assertUnauthorized();
        $this->getJson('/api/v1/attachments/encrypted/'.(string) Str::uuid().'/url')
            ->assertUnauthorized();
    }

    public function test_plaintext_chat_attachment_endpoint_still_exists(): void
    {
        $alice = User::factory()->create(['email_verified_at' => now()]);
        Sanctum::actingAs($alice);

        // Without a file the plaintext endpoint must still answer with validation, not 404.
        $this->postJson('/api/v1/messages/attachments', [])->assertStatus(422);
    }
}
