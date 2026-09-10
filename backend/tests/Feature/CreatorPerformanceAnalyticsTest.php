<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreatorPerformanceAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_creator_performance_analytics_response(): void
    {
        $user = User::factory()->create(['role' => 'creator', 'country' => 'US']);
        $follower = User::factory()->create(['country' => 'GB']);

        // Follow
        \Illuminate\Support\Facades\DB::table('follows')->insert([
            'follower_id' => $follower->id,
            'following_id' => $user->id,
            'created_at' => now()->subDays(2),
            'updated_at' => now()->subDays(2),
        ]);

        // Post
        $post = \App\Models\Post::factory()->create([
            'user_id' => $user->id,
            'is_draft' => false,
            'views_count' => 50,
            'likes_count' => 10,
            'comments_count' => 5,
            'created_at' => now()->subDays(3),
        ]);

        \App\Models\PostReaction::create([
            'post_id' => $post->id,
            'user_id' => $follower->id,
            'type' => 'like',
            'created_at' => now()->subDays(2),
        ]);

        \App\Models\PostComment::create([
            'post_id' => $post->id,
            'user_id' => $follower->id,
            'content' => 'Great post!',
            'created_at' => now()->subDays(1),
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/analytics/creator-performance?range=28d');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'summary' => ['views', 'engagement', 'net_follows', 'reach'],
                'time_series',
                'top_content',
                'audience',
                'profile_status',
                'planned_content',
            ],
            'success',
        ]);
    }
}
