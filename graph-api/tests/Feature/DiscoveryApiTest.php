<?php

namespace Tests\Feature;

use App\Services\MainApiClient;
use GuzzleHttp\Psr7\Response as GuzzleResponse;
use GuzzleHttp\Exception\ClientException;
use GuzzleHttp\Psr7\Request as GuzzleRequest;
use Mockery;
use Tests\TestCase;

class DiscoveryApiTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_trending_endpoint_normalises_upstream_hashtags_and_creators(): void
    {
        $mock = Mockery::mock(MainApiClient::class);
        $mock->shouldReceive('getTrending')->once()->andReturn([
            'data' => [
                'trending_topics' => [
                    [
                        'tag' => '#LaunchWeek',
                        'raw_count' => 3,
                        'posts_count' => 4,
                        'trend_score' => 2.1,
                        'growth' => 50.0,
                        'is_growing' => true,
                    ],
                ],
                'suggested_creators' => [
                    ['id' => 7, 'username' => 'creator_one', 'name' => 'Creator One'],
                ],
                'featured_trending' => ['tag' => '#LaunchWeek', 'title' => '#LaunchWeek'],
            ],
        ]);

        $this->app->instance(MainApiClient::class, $mock);

        $res = $this->getJson('/v1/discovery/trending');

        $res->assertStatus(200)
            ->assertJsonPath('data.trending_topics.0.type', 'hashtag')
            ->assertJsonPath('data.trending_topics.0.tag', '#LaunchWeek')
            ->assertJsonPath('data.trending_topics.0.posts_count', 4)
            ->assertJsonPath('data.trending_topics.0.is_growing', true)
            ->assertJsonPath('data.suggested_creators.0.username', 'creator_one');
    }

    public function test_hashtags_endpoint_returns_normalised_collection(): void
    {
        $mock = Mockery::mock(MainApiClient::class);
        $mock->shouldReceive('suggestHashtags')->once()->andReturn([
            'data' => [
                'hashtags' => [
                    ['tag' => '#TechTrends', 'posts_count' => 2],
                ],
            ],
        ]);

        $this->app->instance(MainApiClient::class, $mock);

        $res = $this->getJson('/v1/discovery/hashtags?q=tech');

        $res->assertStatus(200)
            ->assertJsonPath('data.0.type', 'hashtag')
            ->assertJsonPath('data.0.tag', '#TechTrends')
            ->assertJsonPath('data.0.id', 'htg_techtrends');
    }

    public function test_hashtag_detail_maps_upstream_404_to_graph_error(): void
    {
        $mock = Mockery::mock(MainApiClient::class);
        $mock->shouldReceive('getHashtag')->once()->andThrow(
            new ClientException('Not Found', new GuzzleRequest('GET', 'v1/discover/hashtags/missing'), new GuzzleResponse(404))
        );

        $this->app->instance(MainApiClient::class, $mock);

        $res = $this->getJson('/v1/discovery/hashtags/missing');

        $res->assertStatus(404);
    }
}
