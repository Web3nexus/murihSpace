<?php

namespace Tests\Feature;

use App\Jobs\DeleteExpiredChatMedia;
use App\Models\AdminSetting;
use App\Models\AuditLog;
use App\Models\Media;
use App\Models\MediaRetentionHold;
use App\Models\User;
use App\Services\MediaRetentionService;
use App\Services\StorageQuotaService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MediaRetentionTest extends TestCase
{
    use RefreshDatabase;

    private function superAdmin(): User
    {
        return User::factory()->create(['role' => 'admin', 'admin_role' => 'super_admin']);
    }

    private function makeMedia(array $overrides = []): Media
    {
        return Media::create(array_merge([
            'user_id' => User::factory()->create()->id,
            'disk' => 'local_uploads',
            'folder' => 'message_attachments',
            'filename' => 'photo.jpg',
            'original_name' => 'photo.jpg',
            'path' => 'message_attachments/photo.jpg',
            'url' => '/storage/uploads/message_attachments/photo.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 2048,
        ], $overrides));
    }

    public function test_default_retention_is_seven_days(): void
    {
        $service = app(MediaRetentionService::class);
        $config = $service->config();

        $this->assertEquals(7, $config['default_retention_days']);

        $uploadedAt = Carbon::parse('2026-08-04 10:00:00');
        $this->assertEquals('2026-08-11 10:00:00', $service->deleteAfterFor('image', $uploadedAt)->toDateTimeString());
    }

    public function test_per_type_override_controls_delete_after(): void
    {
        $service = app(MediaRetentionService::class);
        $actor = $this->superAdmin();

        $service->updateConfig([
            'default_retention_days' => 7,
            'max_retention_days' => 365,
            'retention_by_type' => ['image' => 30, 'video' => 14],
        ], $actor);

        $this->assertEquals(30, $service->retentionDaysFor('image'));
        $this->assertEquals(14, $service->retentionDaysFor('video'));
        $this->assertEquals(7, $service->retentionDaysFor('voice'));

        $media = $this->makeMedia(['created_at' => now()]);
        $service->applyToUpload($media, 'image');

        $this->assertEquals(now()->addDays(30)->format('Y-m-d'), $media->fresh()->delete_after->format('Y-m-d'));
        $this->assertEquals('available', $media->fresh()->lifecycle_status);
    }

    public function test_admin_can_update_retention_settings_and_audit_is_written(): void
    {
        $admin = $this->superAdmin();
        Sanctum::actingAs($admin);

        $response = $this->putJson('/api/v1/securegate/messaging-retention', [
            'default_retention_days' => 14,
            'max_retention_days' => 90,
            'enable_automatic_deletion' => true,
            'enable_user_download_warning' => true,
            'warning_days' => 5,
            'batch_size' => 100,
            'schedule_time' => '02:30',
            'retention_by_type' => ['video' => 30],
            'holds' => ['reported' => true, 'dispute' => true, 'order' => false, 'legal' => true],
        ]);

        $response->assertOk();

        $stored = json_decode(AdminSetting::get('media_retention'), true);
        $this->assertEquals(14, $stored['default_retention_days']);
        $this->assertEquals(30, $stored['retention_by_type']['video']);
        $this->assertFalse($stored['holds']['order']);

        $this->assertDatabaseHas('audit_logs', ['action' => 'media_retention.updated', 'user_id' => $admin->id]);
    }

    public function test_non_admin_cannot_access_retention_settings(): void
    {
        $member = User::factory()->create(['role' => 'member']);
        Sanctum::actingAs($member);

        $this->getJson('/api/v1/securegate/messaging-retention')->assertForbidden();
        $this->putJson('/api/v1/securegate/messaging-retention', ['default_retention_days' => 5])->assertForbidden();
    }

    public function test_active_hold_blocks_deletion(): void
    {
        Storage::fake('local_uploads');
        Storage::disk('local_uploads')->put('message_attachments/photo.jpg', 'binary');

        $service = app(MediaRetentionService::class);
        $actor = $this->superAdmin();
        $media = $this->makeMedia(['delete_after' => now()->subDay(), 'lifecycle_status' => 'available']);

        $service->placeHold($media, ['hold_type' => 'dispute', 'reason' => 'Case #123 in progress'], $actor);

        $result = $service->expire($media);

        $this->assertEquals('held', $result['status']);
        $this->assertEquals('dispute', $result['held']);
        $this->assertEquals('held', $media->fresh()->lifecycle_status);
        Storage::disk('local_uploads')->assertExists('message_attachments/photo.jpg');
    }

    public function test_expire_deletes_file_and_derived_artifacts(): void
    {
        Storage::fake('local_uploads');
        $disk = Storage::disk('local_uploads');
        $disk->put('message_attachments/photo.jpg', 'binary');
        $disk->put('message_attachments/thumbnails/photo_320.jpg', 'thumb');
        $disk->put('message_attachments/thumbnails/photo_640.jpg', 'thumb');
        $disk->put('message_attachments/photo.webp', 'webp');

        $user = User::factory()->create();
        $quota = app(StorageQuotaService::class);
        $quota->addUsage('user', $user->id, 'image', 2048);

        $media = $this->makeMedia(['user_id' => $user->id, 'delete_after' => now()->subDay(), 'lifecycle_status' => 'available']);

        $result = app(MediaRetentionService::class)->expire($media);

        $this->assertEquals('deleted', $result['status']);

        $disk->assertMissing('message_attachments/photo.jpg');
        $disk->assertMissing('message_attachments/thumbnails/photo_320.jpg');
        $disk->assertMissing('message_attachments/thumbnails/photo_640.jpg');
        $disk->assertMissing('message_attachments/photo.webp');

        $fresh = $media->fresh();
        $this->assertEquals('deleted', $fresh->lifecycle_status);
        $this->assertNotNull($fresh->expired_at);

        $this->assertDatabaseHas('media_retention_logs', ['media_id' => $media->id, 'event' => 'deleted']);
        $this->assertEquals(0, $quota->getUserUsage($user));
    }

    public function test_expire_is_idempotent(): void
    {
        Storage::fake('local_uploads');

        $media = $this->makeMedia(['delete_after' => now()->subDay(), 'lifecycle_status' => 'available']);
        $service = app(MediaRetentionService::class);

        $this->assertEquals('deleted', $service->expire($media)['status']);
        $this->assertEquals('already_deleted', $service->expire($media->fresh())['status']);
    }

    public function test_expired_batch_returns_only_eligible_media(): void
    {
        $service = app(MediaRetentionService::class);

        $expired = $this->makeMedia(['delete_after' => now()->subDay(), 'lifecycle_status' => 'available']);
        $held = $this->makeMedia(['delete_after' => now()->subDay(), 'lifecycle_status' => 'held']);
        $future = $this->makeMedia(['delete_after' => now()->addDays(5), 'lifecycle_status' => 'available']);
        $deleted = $this->makeMedia(['delete_after' => now()->subDay(), 'lifecycle_status' => 'deleted', 'expired_at' => now()]);

        $ids = $service->expiredBatch()->pluck('id')->all();

        $this->assertContains($expired->id, $ids);
        $this->assertNotContains($held->id, $ids);
        $this->assertNotContains($future->id, $ids);
        $this->assertNotContains($deleted->id, $ids);
    }

    public function test_admin_can_place_and_release_hold_via_api(): void
    {
        $admin = $this->superAdmin();
        Sanctum::actingAs($admin);

        $media = $this->makeMedia(['delete_after' => now()->subDay(), 'lifecycle_status' => 'available']);

        $place = $this->postJson('/api/v1/securegate/messaging-retention/holds', [
            'media_id' => $media->id,
            'hold_type' => 'legal',
            'reason' => 'Pending litigation',
            'case_ref' => 'CASE-9001',
        ]);
        $place->assertCreated();

        $this->assertEquals('held', $media->fresh()->lifecycle_status);
        $this->assertDatabaseHas('media_retention_holds', ['media_id' => $media->id, 'status' => 'active']);

        $holdId = $place->json('data.data.id');
        $release = $this->deleteJson("/api/v1/securegate/messaging-retention/holds/{$holdId}");
        $release->assertOk();

        $this->assertEquals('released', MediaRetentionHold::find($holdId)->status);
        $this->assertEquals('scheduled_for_deletion', $media->fresh()->lifecycle_status);
    }

    public function test_retention_command_dispatches_deletion_jobs_with_lock(): void
    {
        Queue::fake();
        Storage::fake('local_uploads');

        $service = app(MediaRetentionService::class);
        $expired = $this->makeMedia(['delete_after' => now()->subDay(), 'lifecycle_status' => 'available']);
        $this->makeMedia(['delete_after' => now()->addDays(10), 'lifecycle_status' => 'available']);

        $this->artisan('media:expire-retained')->assertExitCode(0);

        Queue::assertPushed(DeleteExpiredChatMedia::class, fn ($job) => $job->mediaId === $expired->id);
    }

    public function test_expiry_notification_is_sent_only_once(): void
    {
        $service = app(MediaRetentionService::class);
        $media = $this->makeMedia(['delete_after' => now()->addDays(3), 'lifecycle_status' => 'available']);

        DB::table('media_retention_logs')->insert([
            'media_id' => $media->id,
            'event' => 'expiry_notified',
            'reason' => 'already notified',
            'created_at' => now(),
        ]);

        $service->expiringWarningBatch(5)->each(function ($m) use ($media) {
            $this->assertNotEquals($media->id, $m->id);
        });
    }

    public function test_automatic_moderation_hold_blocks_deletion(): void
    {
        Storage::fake('local_uploads');

        $service = app(MediaRetentionService::class);
        $media = $this->makeMedia(['delete_after' => now()->subDay(), 'lifecycle_status' => 'available']);

        DB::table('reports')->insert([
            'reported_type' => 'message',
            'reported_id' => 999,
            'reporter_id' => $this->superAdmin()->id,
            'reason' => 'inappropriate',
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertNotNull($service->activeHoldFor($media));
        $this->assertEquals('held', $service->expire($media)['status']);
    }

    public function test_upload_schedules_media_for_deletion(): void
    {
        Storage::fake('local_uploads');
        Sanctum::actingAs($this->superAdmin());

        $response = $this->postJson('/api/v1/messages/attachments', [
            'file' => \Illuminate\Http\UploadedFile::fake()->image('pic.jpg'),
        ]);

        $response->assertStatus(201);

        $media = Media::latest('id')->first();
        $this->assertNotNull($media->delete_after);
        $this->assertEquals('scanning', $media->lifecycle_status);
        $this->assertDatabaseHas('media_retention_logs', ['media_id' => $media->id, 'event' => 'scheduled']);
    }

    public function test_message_exposes_media_expiry_info(): void
    {
        $media = $this->makeMedia(['delete_after' => now()->addDays(7), 'lifecycle_status' => 'available']);
        $conversation = \App\Models\Conversation::create(['type' => 'direct']);

        $message = \App\Models\Message::create([
            'conversation_id' => $conversation->id,
            'user_id' => $media->user_id,
            'content' => 'See attached',
            'type' => 'image',
            'status' => 'sent',
            'media_id' => $media->id,
            'attachment_url' => $media->url,
            'attachment_type' => 'image',
        ]);

        $this->assertNotNull($message->media_expiry);
        $this->assertFalse($message->media_expiry['expired']);
        $this->assertEquals(7, $message->media_expiry['expires_in_days']);
        $this->assertEquals('available', $message->media_expiry['lifecycle_status']);
    }

    public function test_expired_media_reports_metadata_for_frontend(): void
    {
        $media = $this->makeMedia(['delete_after' => now()->subDay(), 'lifecycle_status' => 'deleted', 'expired_at' => now()]);

        $info = app(MediaRetentionService::class)->expirationInfo($media);

        $this->assertTrue($info['expired']);
        $this->assertNull($info['expires_in_days']);
        $this->assertEquals('deleted', $info['lifecycle_status']);
    }
}
