<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PostCreationAndPollTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_public_profile_post_without_community(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/posts', [
            'type' => 'post',
            'content' => 'This is my personal public status update for everyone!',
            'privacy' => 'public',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.post.content', 'This is my personal public status update for everyone!')
            ->assertJsonPath('data.post.community_id', null);

        $this->assertDatabaseHas('posts', [
            'user_id' => $user->id,
            'community_id' => null,
            'content' => 'This is my personal public status update for everyone!',
        ]);
    }

    public function test_user_can_create_and_vote_on_a_poll(): void
    {
        $creator = User::factory()->create();
        $voter = User::factory()->create();

        Sanctum::actingAs($creator);

        $response = $this->postJson('/api/v1/posts', [
            'type' => 'poll',
            'content' => 'What is your favorite mobile development framework?',
            'poll_question' => 'Pick your preferred stack:',
            'poll_options' => ['Flutter', 'React Native', 'Native Swift/Kotlin'],
            'poll_ends_at' => now()->addDays(3)->toIso8601String(),
            'privacy' => 'public',
        ]);

        $response->assertStatus(201);
        $postId = $response->json('data.post.id');

        // Cast vote as voter
        Sanctum::actingAs($voter);
        $voteResponse = $this->postJson("/api/v1/posts/{$postId}/poll/vote", [
            'option_index' => 0,
        ]);

        $voteResponse->assertStatus(200)
            ->assertJsonPath('data.user_poll_vote', 0)
            ->assertJsonPath('data.poll_results.total_votes', 1)
            ->assertJsonPath('data.poll_results.options.0.votes_count', 1)
            ->assertJsonPath('data.poll_results.options.0.percentage', 100);

        $this->assertDatabaseHas('post_poll_votes', [
            'post_id' => $postId,
            'user_id' => $voter->id,
            'option_index' => 0,
        ]);
    }

    public function test_user_can_create_community_notice_announcement(): void
    {
        $owner = User::factory()->create();
        $community = Community::factory()->create(['user_id' => $owner->id]);

        Sanctum::actingAs($owner);

        $response = $this->postJson('/api/v1/posts', [
            'community_id' => $community->id,
            'type' => 'announcement',
            'content' => 'Important community maintenance notice this Sunday!',
            'privacy' => 'public',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.post.type', 'announcement')
            ->assertJsonPath('data.post.community_id', $community->id);
    }
}
