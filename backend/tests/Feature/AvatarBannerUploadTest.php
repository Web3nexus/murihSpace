<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class AvatarBannerUploadTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local_uploads');
    }

    public function test_user_can_upload_avatar_successfully(): void
    {
        $user = User::factory()->create();
        $this->actAsSession($user);

        $file = UploadedFile::fake()->image('my_avatar.jpg', 300, 300);

        $response = $this->postJson('/api/v1/profile/avatar', [
            'file' => $file,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Avatar updated successfully.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'avatar',
                'avatar_url',
                'url',
                'data' => [
                    'avatar',
                    'avatar_url',
                    'url',
                    'user',
                ],
                'user',
            ]);

        $user->refresh();
        $this->assertNotEmpty($user->avatar);
        $this->assertNotEmpty($user->avatar_url);
    }

    public function test_user_can_upload_banner_successfully(): void
    {
        $user = User::factory()->create();
        $this->actAsSession($user);

        $file = UploadedFile::fake()->image('my_banner.png', 1200, 400);

        $response = $this->postJson('/api/v1/profile/banner', [
            'file' => $file,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cover banner updated successfully.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'banner_url',
                'url',
                'data' => [
                    'banner_url',
                    'url',
                    'user',
                ],
                'user',
            ]);

        $user->refresh();
        $this->assertNotEmpty($user->banner_url);
    }

    public function test_user_can_upload_media_file(): void
    {
        $user = User::factory()->create();
        $this->actAsSession($user);

        $file = UploadedFile::fake()->image('post_image.jpg', 800, 600);

        $response = $this->postJson('/api/v1/upload', [
            'file' => $file,
            'folder' => 'posts',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'File uploaded successfully.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'url',
                'data' => [
                    'url',
                ],
            ]);

        $this->assertDatabaseHas('media', [
            'user_id' => $user->id,
            'folder' => 'posts',
        ]);
    }

    public function test_user_can_create_post_with_media_and_text(): void
    {
        $user = User::factory()->create();
        $this->actAsSession($user);

        $response = $this->postJson('/api/v1/posts', [
            'type' => 'post',
            'content' => 'Hello MurihSpace with photos!',
            'privacy' => 'public',
            'media_urls' => [
                'https://murihspace.test/storage/uploads/posts/photo1.jpg',
                'https://murihspace.test/storage/uploads/posts/photo2.jpg',
            ],
            'hashtags' => ['#community', '#vibes'],
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Post published successfully.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'post' => [
                    'id',
                    'content',
                    'media_urls',
                ],
                'data' => [
                    'post',
                ],
            ]);

        $this->assertDatabaseHas('posts', [
            'user_id' => $user->id,
            'content' => 'Hello MurihSpace with photos!',
            'privacy' => 'public',
        ]);
    }
}

