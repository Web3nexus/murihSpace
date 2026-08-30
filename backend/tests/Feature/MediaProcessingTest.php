<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaProcessingTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_request_signed_upload_url(): void
    {
        Storage::fake('contabo');
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/signed-upload-url', [
                'filename' => 'test-video.mp4',
                'mime_type' => 'video/mp4',
                'size_bytes' => 1024 * 1024 * 5,
                'folder' => 'posts',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'media',
                    'upload_mode',
                    'upload_url',
                ],
            ]);

        $this->assertDatabaseHas('media', [
            'user_id' => $user->id,
            'original_name' => 'test-video.mp4',
            'media_type' => 'video',
            'processing_status' => Media::STATUS_PENDING_UPLOAD,
        ]);
    }

    public function test_complete_upload_dispatches_processing_job(): void
    {
        Storage::fake('contabo');
        Queue::fake();

        $user = User::factory()->create();
        $media = Media::create([
            'user_id' => $user->id,
            'disk' => 'contabo',
            'folder' => 'uploads',
            'filename' => 'video.mp4',
            'original_name' => 'video.mp4',
            'path' => 'uploads/2026/08/uuid/video.mp4',
            'url' => 'https://eu2.contabostorage.com/test/video.mp4',
            'mime_type' => 'video/mp4',
            'media_type' => Media::TYPE_VIDEO,
            'size_bytes' => 102400,
            'processing_status' => Media::STATUS_PENDING_UPLOAD,
        ]);

        Storage::disk('contabo')->put($media->path, 'fake video content');

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/complete', [
                'media_uuid' => $media->uuid,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('media', [
            'id' => $media->id,
            'processing_status' => Media::STATUS_QUEUED,
        ]);
    }

    public function test_admin_can_view_media_stats_and_list(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'admin_role' => 'super_admin']);

        Media::create([
            'user_id' => $admin->id,
            'disk' => 'contabo',
            'folder' => 'uploads',
            'filename' => 'test.jpg',
            'original_name' => 'test.jpg',
            'path' => 'uploads/test.jpg',
            'url' => 'https://eu2.contabostorage.com/test/test.jpg',
            'mime_type' => 'image/jpeg',
            'media_type' => Media::TYPE_IMAGE,
            'size_bytes' => 5000,
            'processing_status' => Media::STATUS_COMPLETED,
        ]);

        $statsRes = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/securegate/media/stats');

        $statsRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_media_count', 1);

        $listRes = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/securegate/media');

        $listRes->assertStatus(200)
            ->assertJsonPath('success', true);
    }
}
