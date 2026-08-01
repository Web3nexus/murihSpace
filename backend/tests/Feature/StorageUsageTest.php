<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\StorageUsage;
use App\Models\User;
use App\Services\StorageQuotaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class StorageUsageTest extends TestCase
{
    use RefreshDatabase;

    public function test_storage_usage_increases_on_upload(): void
    {
        $quota = app(StorageQuotaService::class);
        $user = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);

        $quota->addUsage('user', $user->id, 'image', 5000);

        $this->assertEquals(5000, $quota->getUserUsage($user));
    }

    public function test_storage_usage_tracks_multiple_media_types(): void
    {
        $quota = app(StorageQuotaService::class);
        $user = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);

        $quota->addUsage('user', $user->id, 'image', 1000);
        $quota->addUsage('user', $user->id, 'video', 10000);
        $quota->addUsage('user', $user->id, 'voice', 500);

        $this->assertEquals(11500, $quota->getUserUsage($user));
    }

    public function test_storage_usage_decreases_on_removal(): void
    {
        $quota = app(StorageQuotaService::class);
        $user = User::factory()->create(['role' => 'member', 'email_verified_at' => now()]);

        $quota->addUsage('user', $user->id, 'image', 5000);
        $quota->removeUsage('user', $user->id, 'image', 2000);

        $this->assertEquals(3000, $quota->getUserUsage($user));
    }

    public function test_quota_blocks_upload_when_limit_exceeded(): void
    {
        $quota = app(StorageQuotaService::class);
        $user = User::factory()->create([
            'role' => 'member',
            'email_verified_at' => now(),
            'storage_limit_bytes' => 1000,
        ]);

        $file = UploadedFile::fake()->create('test.jpg', 2);

        $error = $quota->checkUserQuota($user, $file);

        $this->assertNotNull($error);
        $this->assertStringContainsString('storage limit', $error);
    }

    public function test_quota_allows_upload_when_within_limit(): void
    {
        $quota = app(StorageQuotaService::class);
        $user = User::factory()->create([
            'role' => 'member',
            'email_verified_at' => now(),
            'storage_limit_bytes' => 100000,
        ]);

        $file = UploadedFile::fake()->create('test.jpg', 50);

        $error = $quota->checkUserQuota($user, $file);

        $this->assertNull($error);
    }

    public function test_community_storage_usage_tracks_independently(): void
    {
        $quota = app(StorageQuotaService::class);
        $community = Community::factory()->create();

        $quota->addUsage('community', $community->id, 'image', 5000);
        $quota->addUsage('community', $community->id, 'video', 15000);

        $this->assertEquals(20000, $quota->getCommunityUsage($community));
    }

    public function test_mime_classification(): void
    {
        $quota = app(StorageQuotaService::class);

        $this->assertEquals('image', $quota->classifyMimeType('image/jpeg'));
        $this->assertEquals('video', $quota->classifyMimeType('video/mp4'));
        $this->assertEquals('voice', $quota->classifyMimeType('audio/mpeg'));
        $this->assertEquals('document', $quota->classifyMimeType('application/pdf'));
    }
}
