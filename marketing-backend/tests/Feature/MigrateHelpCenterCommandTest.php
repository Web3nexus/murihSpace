<?php

namespace Tests\Feature;

use App\Models\HelpArticle;
use App\Models\HelpCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MigrateHelpCenterCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_imports_categories_articles_and_revisions(): void
    {
        $this->artisan('support:migrate-help-center')->assertSuccessful();

        $this->assertSame(9, HelpCategory::count());
        $this->assertSame(22, HelpArticle::count());
        $this->assertSame(22, HelpArticle::count());

        $article = HelpArticle::where('slug', 'create-account')->first();
        $this->assertNotNull($article);
        $this->assertSame('How to create a MurihSpace account', $article->title);
        $this->assertSame('published', $article->state);
        $this->assertCount(3, $article->sections);
        $this->assertCount(1, $article->revisions);

        $category = HelpCategory::where('slug', 'getting-started')->first();
        $this->assertSame('Getting Started', $category->name);
    }

    public function test_it_is_idempotent(): void
    {
        $this->artisan('support:migrate-help-center')->assertSuccessful();

        $first = HelpArticle::count();

        $this->artisan('support:migrate-help-center')->assertSuccessful();

        $this->assertSame($first, HelpArticle::count());
        $this->assertSame(22, HelpArticle::count());

        $article = HelpArticle::where('slug', 'send-gift')->first();
        $this->assertCount(2, $article->relatedArticles);
    }

    public function test_it_preserves_article_content(): void
    {
        $this->artisan('support:migrate-help-center')->assertSuccessful();

        $article = HelpArticle::where('slug', 'wallet-types')->first();
        $this->assertStringContainsString('System Wallet', $article->body);
        $this->assertContains('wallet', $article->keywords);
        $this->assertSame('murihpay', $article->category->slug);
    }
}
