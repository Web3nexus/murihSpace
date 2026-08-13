<?php

namespace Tests\Feature;

use App\Models\HelpArticle;
use App\Models\HelpSearchTerm;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicHelpApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('support:migrate-help-center');
    }

    public function test_categories_endpoint_returns_published_counts(): void
    {
        $this->getJson('/api/public/help/categories')
            ->assertOk()
            ->assertJsonCount(9, 'data')
            ->assertJsonPath('data.0.slug', 'getting-started')
            ->assertJsonPath('data.0.article_count', 3);
    }

    public function test_articles_endpoint_can_filter_by_category(): void
    {
        $this->getJson('/api/public/help/articles?category=gifting')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_article_endpoint_returns_full_article_and_increments_views(): void
    {
        $this->getJson('/api/public/help/articles/send-gift')
            ->assertOk()
            ->assertJsonPath('data.title', 'How to send a gift')
            ->assertJsonPath('data.category', 'gifting');

        $this->assertSame(1, HelpArticle::where('slug', 'send-gift')->value('view_count'));
    }

    public function test_unknown_article_returns_404(): void
    {
        $this->getJson('/api/public/help/articles/does-not-exist')->assertNotFound();
    }

    public function test_search_returns_ranked_results_and_logs_terms(): void
    {
        $this->getJson('/api/public/help/search?q=gift')
            ->assertOk()
            ->assertJsonCount(4, 'data')
            ->assertJsonPath('data.0.slug', 'receive-gift');

        $this->assertDatabaseHas('help_search_terms', ['query' => 'gift']);
        $this->assertSame(4, HelpSearchTerm::where('query', 'gift')->value('result_count'));
    }

    public function test_search_returns_empty_for_unknown_terms(): void
    {
        $this->getJson('/api/public/help/search?q=zzzznotfound')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_feedback_records_helpfulness(): void
    {
        $this->postJson('/api/public/help/articles/send-gift/feedback', [
            'helpful' => true,
        ])->assertOk();

        $this->assertDatabaseHas('help_article_feedback', ['helpful' => true]);
        $this->assertSame(1, HelpArticle::where('slug', 'send-gift')->value('helpful_count'));
    }

    public function test_public_responses_are_cacheable(): void
    {
        $response = $this->get('/api/public/help/categories');
        $response->assertHeader('Cache-Control', 'max-age=300, public');
    }
}
