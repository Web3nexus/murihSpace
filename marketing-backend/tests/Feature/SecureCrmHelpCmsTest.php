<?php

namespace Tests\Feature;

use App\Models\HelpArticle;
use App\Models\HelpArticleRevision;
use App\Models\HelpCategory;
use App\Models\StaffUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SecureCrmHelpCmsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->actingAs(StaffUser::factory()->role('help_editor')->create(), 'staff');
    }

    // ── Index / access ────────────────────────────────────────────

    public function test_editor_can_view_help_index(): void
    {
        HelpArticle::factory()->published()->create(['title' => 'Reset password']);

        $this->get('/securecrm/help')
            ->assertOk()
            ->assertSee('Reset password')
            ->assertSee('New article');
    }

    public function test_agent_without_help_article_view_is_forbidden(): void
    {
        $agent = StaffUser::factory()
            ->role('support_agent')
            ->withPermissions(['ticket.view'])
            ->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/help')
            ->assertForbidden();
    }

    public function test_index_filters_by_state_and_category(): void
    {
        $category = HelpCategory::factory()->create();
        HelpArticle::factory()->published()->create(['category_id' => $category->id, 'title' => 'Published one']);
        HelpArticle::factory()->draft()->create(['category_id' => $category->id, 'title' => 'Draft one']);
        HelpArticle::factory()->draft()->create(['title' => 'Draft other category']);

        $this->get('/securecrm/help?state=draft&category='.$category->id)
            ->assertOk()
            ->assertSee('Draft one')
            ->assertDontSee('Published one')
            ->assertDontSee('Draft other category');
    }

    // ── Create ────────────────────────────────────────────────────

    public function test_editor_can_create_article_as_draft_with_revision(): void
    {
        $category = HelpCategory::factory()->create();

        $this->post('/securecrm/help', [
            'category_id' => $category->id,
            'title' => 'How to reset your password',
            'slug' => 'reset-password',
            'excerpt' => 'Steps to reset a forgotten password.',
            'body' => "## Steps\n\nType it.",
            'sections' => [
                ['heading' => 'Step one', 'body' => 'Click forgot password.'],
                ['heading' => '', 'body' => ''],
            ],
            'keywords_text' => 'password, reset, recovery',
            'tags_text' => 'security, account',
            'featured' => '1',
            'seo_title' => 'Reset your MurihSpace password',
            'seo_description' => 'Two-minute guide.',
            'related' => [],
        ])->assertRedirect('/securecrm/help/'.HelpArticle::where('slug', 'reset-password')->first()->id);

        $article = HelpArticle::where('slug', 'reset-password')->firstOrFail();
        $this->assertSame('draft', $article->state);
        $this->assertSame(['password', 'reset', 'recovery'], $article->keywords);
        $this->assertSame(['security', 'account'], $article->tags);
        $this->assertTrue($article->featured);
        $this->assertSame('Reset your MurihSpace password', $article->seo_title);
        $this->assertCount(1, $article->sections);
        $this->assertSame(1, $article->revisions()->count());
        $this->assertSame('Created', $article->revisions()->first()->note);
    }

    public function test_create_without_editor_permission_is_forbidden(): void
    {
        $editor = StaffUser::factory()
            ->role('help_editor')
            ->withPermissions(['help.article.view'])
            ->create();

        $this->actingAs($editor, 'staff')
            ->get('/securecrm/help/create')
            ->assertForbidden();
    }

    // ── Edit / revision safety ────────────────────────────────────

    public function test_update_snapshots_previous_version_as_recoverable_revision(): void
    {
        $article = HelpArticle::factory()->published()->create([
            'title' => 'Original title',
            'body' => 'Original published body',
        ]);
        HelpArticleRevision::factory()->numbered(1)->create([
            'article_id' => $article->id,
            'title' => 'Original title',
            'body' => 'Original published body',
        ]);

        $this->patch("/securecrm/help/{$article->id}", [
            'title' => 'Edited title',
            'body' => 'New body after edit',
            'slug' => $article->slug,
            'related' => [],
        ])->assertRedirect("/securecrm/help/{$article->id}");

        $article->refresh();
        $this->assertSame('Edited title', $article->title);

        // The previously published state must remain recoverable.
        $revision = $article->revisions()->orderByDesc('revision_number')->first();
        $this->assertSame(2, $revision->revision_number);
        $this->assertSame('Original title', $revision->title);
        $this->assertSame('Original published body', $revision->body);
    }

    public function test_slug_is_unique_and_appends_counter(): void
    {
        HelpArticle::factory()->create(['slug' => 'same-slug']);

        $this->post('/securecrm/help', [
            'title' => 'First',
            'slug' => 'same-slug',
        ])->assertRedirect();

        $second = HelpArticle::where('title', 'First')->firstOrFail();
        $this->assertSame('same-slug-2', $second->slug);
    }

    public function test_restore_revision_snapshots_current_state_first(): void
    {
        $article = HelpArticle::factory()->published()->create(['title' => 'Current', 'body' => 'Current body']);
        HelpArticleRevision::factory()->numbered(1)->create(['article_id' => $article->id, 'title' => 'Original', 'body' => 'Original body']);
        HelpArticleRevision::factory()->numbered(2)->create(['article_id' => $article->id, 'title' => 'Current', 'body' => 'Current body']);

        $this->post("/securecrm/help/{$article->id}/revisions/1/restore")
            ->assertRedirect();

        $article->refresh();
        $this->assertSame('Original', $article->title);
        $this->assertSame('Original body', $article->body);

        // Restore is reversible: current state was kept as revision 3.
        $this->assertSame(3, $article->revisions()->count());
        $this->assertSame('Current', $article->revisions()->orderByDesc('revision_number')->first()->title);
    }

    // ── State transitions ─────────────────────────────────────────

    public function test_publish_unpublish_archive_restore_cycle(): void
    {
        $article = HelpArticle::factory()->draft()->create();

        $this->post("/securecrm/help/{$article->id}/publish")->assertRedirect();
        $this->assertSame('published', $article->refresh()->state);
        $this->assertNotNull($article->published_at);

        $this->post("/securecrm/help/{$article->id}/unpublish")->assertRedirect();
        $this->assertSame('draft', $article->refresh()->state);

        $this->post("/securecrm/help/{$article->id}/archive")->assertRedirect();
        $this->assertSame('archived', $article->refresh()->state);
        $this->assertNotNull($article->archived_at);

        $this->post("/securecrm/help/{$article->id}/restore")->assertRedirect();
        $this->assertSame('draft', $article->refresh()->state);
    }

    public function test_archived_article_cannot_be_published_directly(): void
    {
        $article = HelpArticle::factory()->archived()->create();

        $this->post("/securecrm/help/{$article->id}/publish")
            ->assertSessionHas('error');

        $this->assertSame('archived', $article->refresh()->state);
    }

    public function test_editor_without_publish_permission_cannot_publish(): void
    {
        $editor = StaffUser::factory()
            ->role('help_editor')
            ->withPermissions(['help.article.view', 'help.article.edit', 'help.article.create'])
            ->create();

        $article = HelpArticle::factory()->draft()->create();

        $this->actingAs($editor, 'staff')
            ->post("/securecrm/help/{$article->id}/publish")
            ->assertForbidden();

        $this->assertSame('draft', $article->refresh()->state);
    }

    public function test_schedule_requires_future_datetime(): void
    {
        $article = HelpArticle::factory()->draft()->create();

        $this->post("/securecrm/help/{$article->id}/schedule", ['scheduled_at' => '2020-01-01 10:00'])
            ->assertSessionHasErrors('scheduled_at');

        $this->post("/securecrm/help/{$article->id}/schedule", ['scheduled_at' => now()->addHour()->format('Y-m-d H:i')])
            ->assertRedirect();

        $this->assertSame('scheduled', $article->refresh()->state);
    }

    public function test_scheduled_articles_publish_when_due(): void
    {
        $due = HelpArticle::factory()->scheduled(now()->subMinute())->create();
        $later = HelpArticle::factory()->scheduled(now()->addDay())->create();

        $this->artisan('support:publish-scheduled-help')->assertSuccessful();

        $this->assertSame('published', $due->refresh()->state);
        $this->assertSame('scheduled', $later->refresh()->state);
    }

    // ── Preview ───────────────────────────────────────────────────

    public function test_preview_renders_article_content(): void
    {
        $article = HelpArticle::factory()->draft()->create(['title' => 'Draft preview', 'excerpt' => 'Shown before publish.']);

        $this->get("/securecrm/help/{$article->id}/preview")
            ->assertOk()
            ->assertSee('Draft preview')
            ->assertSee('Shown before publish.')
            ->assertSee('not live yet');
    }

    // ── Related articles ──────────────────────────────────────────

    public function test_related_articles_are_synced(): void
    {
        $a = HelpArticle::factory()->create();
        $b = HelpArticle::factory()->create();
        $c = HelpArticle::factory()->create();

        $this->post('/securecrm/help', [
            'title' => 'Parent',
            'related' => [$b->id, $c->id, $a->id],
        ])->assertRedirect();

        $parent = HelpArticle::where('title', 'Parent')->firstOrFail();
        $this->assertSame([$b->id, $c->id, $a->id], $parent->relatedArticles()->pluck('help_articles.id')->all());
    }

    // ── Categories ────────────────────────────────────────────────

    public function test_editor_can_manage_categories(): void
    {
        $this->post('/securecrm/help/categories', [
            'name' => 'Payments',
            'blurb' => 'Deposits and payouts.',
            'featured' => '1',
        ])->assertRedirect();

        $category = HelpCategory::where('slug', 'payments')->firstOrFail();
        $this->assertTrue($category->featured);

        $this->patch("/securecrm/help/categories/{$category->id}", [
            'name' => 'Payments & Wallets',
            'is_active' => '0',
        ])->assertRedirect();

        $this->assertSame('Payments & Wallets', $category->refresh()->name);
        $this->assertFalse($category->is_active);

        $this->delete("/securecrm/help/categories/{$category->id}")->assertRedirect();
        $this->assertDatabaseMissing('help_categories', ['id' => $category->id]);
    }

    public function test_category_with_articles_cannot_be_deleted(): void
    {
        $category = HelpCategory::factory()->create();
        HelpArticle::factory()->create(['category_id' => $category->id]);

        $this->delete("/securecrm/help/categories/{$category->id}")
            ->assertSessionHas('error');

        $this->assertDatabaseHas('help_categories', ['id' => $category->id]);
    }

    public function test_duplicate_category_slug_is_rejected(): void
    {
        HelpCategory::factory()->create(['slug' => 'existing']);

        $this->post('/securecrm/help/categories', ['name' => 'Anything'])
            ->assertRedirect();

        // Auto-slug "anything" is free; now collide explicitly.
        $this->post('/securecrm/help/categories', ['name' => 'Existing', 'slug' => 'existing'])
            ->assertSessionHasErrors('slug');
    }

    // ── Attachments ───────────────────────────────────────────────

    public function test_editor_can_upload_download_and_remove_attachment(): void
    {
        Storage::fake('local');

        $article = HelpArticle::factory()->create();

        $this->post("/securecrm/help/{$article->id}/attachments", [
            'attachment' => UploadedFile::fake()->create('guide.pdf', 100),
        ])->assertRedirect();

        $this->assertSame(1, $article->attachments()->count());
        $attachment = $article->attachments()->first();
        $this->assertSame('guide.pdf', $attachment->filename);

        $this->get("/securecrm/help/attachments/{$attachment->id}/download")
            ->assertOk();

        $this->delete("/securecrm/help/attachments/{$attachment->id}")->assertRedirect();
        $this->assertDatabaseMissing('help_attachments', ['id' => $attachment->id]);
        Storage::disk('local')->assertMissing($attachment->path);
    }

    // ── Public API unaffected ─────────────────────────────────────

    public function test_public_api_still_serves_published_only(): void
    {
        $published = HelpArticle::factory()->published()->create();
        HelpArticle::factory()->draft()->create();

        $this->getJson('/api/public/help/articles')
            ->assertOk()
            ->assertJsonPath('data.0.slug', $published->slug)
            ->assertJsonMissing(['slug' => HelpArticle::where('state', 'draft')->first()->slug]);
    }
}
