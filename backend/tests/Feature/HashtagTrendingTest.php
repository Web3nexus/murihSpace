<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HashtagTrendingTest extends TestCase
{
    use RefreshDatabase;

    public function test_trending_topics_are_derived_from_real_hashtag_activity(): void
    {
        $author = User::factory()->create(['status' => 'active']);

        foreach (range(1, 3) as $i) {
            Post::factory()->create([
                'user_id' => $author->id,
                'content' => "Launch update number {$i} #LaunchWeek",
                'hashtags' => ['#LaunchWeek'],
            ]);
        }

        Post::factory()->create([
            'user_id' => $author->id,
            'content' => 'A quiet thought #Reflection',
            'hashtags' => ['#Reflection'],
        ]);

        $res = $this->getJson('/api/v1/discover/trending');
        $res->assertStatus(200);

        $topics = collect($res->json('data.trending_topics'));

        $this->assertSame('#LaunchWeek', $topics->first()['tag']);
        $this->assertSame(3, $topics->first()['raw_count']);

        $tags = $topics->pluck('tag')->all();
        $this->assertNotContains('#MurihSpace', $tags, 'No hardcoded topics should leak through');
        $this->assertNotContains('#CreatorEconomy', $tags);
    }

    public function test_trending_is_empty_when_there_is_no_tracked_activity(): void
    {
        $res = $this->getJson('/api/v1/discover/trending');
        $res->assertStatus(200);

        $this->assertSame([], $res->json('data.trending_topics'));
        $this->assertNull($res->json('data.featured_trending'));
    }

    public function test_hashtags_are_extracted_from_post_content(): void
    {
        $author = User::factory()->create(['status' => 'active']);

        Post::factory()->create([
            'user_id' => $author->id,
            'content' => 'Shipping something new today #BuildInPublic and #Maker',
        ]);

        $this->assertDatabaseHas('hashtags', ['tag' => 'buildinpublic', 'posts_count' => 1]);
        $this->assertDatabaseHas('hashtags', ['tag' => 'maker', 'posts_count' => 1]);
    }

    public function test_hashtag_suggestions_and_detail_endpoints(): void
    {
        $author = User::factory()->create(['status' => 'active']);

        foreach (range(1, 2) as $i) {
            Post::factory()->create([
                'user_id' => $author->id,
                'content' => "Testing the composer {$i} #TechTrends",
            ]);
        }

        $suggest = $this->getJson('/api/v1/discover/hashtags/suggest?q=tech');
        $suggest->assertStatus(200);
        $this->assertNotEmpty($suggest->json('data.hashtags'));
        $this->assertSame('#TechTrends', $suggest->json('data.hashtags.0.tag'));

        $detail = $this->getJson('/api/v1/discover/hashtags/TechTrends');
        $detail->assertStatus(200);
        $this->assertSame('#TechTrends', $detail->json('data.data.tag'));
        $this->assertSame(2, $detail->json('data.data.posts_count'));

        $this->getJson('/api/v1/discover/hashtags/DoesNotExist')->assertStatus(404);
    }

    public function test_deleting_a_post_removes_its_hashtag_usage(): void
    {
        $author = User::factory()->create(['status' => 'active']);

        $post = Post::factory()->create([
            'user_id' => $author->id,
            'content' => 'Temporary announcement #TempTopic',
        ]);

        $this->assertDatabaseHas('hashtags', ['tag' => 'temptopic', 'posts_count' => 1]);

        $post->delete();

        $this->assertDatabaseHas('hashtags', ['tag' => 'temptopic', 'posts_count' => 0]);
    }

    public function test_draft_posts_do_not_count_towards_trending(): void
    {
        $author = User::factory()->create(['status' => 'active']);

        Post::factory()->create([
            'user_id' => $author->id,
            'content' => 'Not published yet #Secret',
            'is_draft' => true,
        ]);

        $this->assertDatabaseMissing('hashtags', ['tag' => 'secret']);
    }
}
