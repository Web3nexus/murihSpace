<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\CmsContent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicCmsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_section_returns_only_published_items(): void
    {
        CmsContent::factory()->inSection('features')->published()->create([
            'content' => ['title' => 'Live Feature', 'description' => 'Visible'],
        ]);
        CmsContent::factory()->inSection('features')->draft()->create([
            'content' => ['title' => 'Draft Feature', 'description' => 'Hidden'],
        ]);
        CmsContent::factory()->inSection('features')->archived()->create([
            'content' => ['title' => 'Archived Feature', 'description' => 'Hidden'],
        ]);

        $this->getJson('/api/public/cms/features')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonFragment(['title' => 'Live Feature'])
            ->assertJsonMissing(['title' => 'Draft Feature']);
    }

    public function test_section_orders_by_sort_order(): void
    {
        CmsContent::factory()->inSection('features')->published()->create([
            'sort_order' => 2,
            'content' => ['title' => 'Second'],
        ]);
        CmsContent::factory()->inSection('features')->published()->create([
            'sort_order' => 0,
            'content' => ['title' => 'First'],
        ]);

        $this->getJson('/api/public/cms/features')
            ->assertOk()
            ->assertJsonPath('data.0.content.title', 'First')
            ->assertJsonPath('data.1.content.title', 'Second');
    }

    public function test_section_payload_contains_structured_fields(): void
    {
        CmsContent::factory()->inSection('homepage')->published()->create([
            'slug' => 'homepage',
            'content' => ['headline' => 'Your audience', 'badge' => 'By creators'],
        ]);

        $this->getJson('/api/public/cms/homepage')
            ->assertOk()
            ->assertJsonPath('data.0.content.headline', 'Your audience')
            ->assertJsonPath('data.0.content.badge', 'By creators')
            ->assertJsonPath('data.0.slug', 'homepage');
    }

    public function test_item_returns_single_published_by_slug(): void
    {
        CmsContent::factory()->inSection('blog')->published()->create([
            'slug' => 'hello-world',
            'title' => 'Hello World',
            'body' => 'First post.',
        ]);

        $this->getJson('/api/public/cms/blog/hello-world')
            ->assertOk()
            ->assertJsonPath('data.title', 'Hello World')
            ->assertJsonPath('data.body', 'First post.');
    }

    public function test_item_returns_404_for_draft_or_missing(): void
    {
        CmsContent::factory()->inSection('blog')->draft()->create(['slug' => 'draft-post']);

        $this->getJson('/api/public/cms/blog/draft-post')->assertNotFound();
        $this->getJson('/api/public/cms/blog/nope')->assertNotFound();
    }

    public function test_unknown_section_returns_404(): void
    {
        $this->getJson('/api/public/cms/not-a-section')->assertNotFound();
    }

    public function test_announcements_returns_only_published(): void
    {
        Announcement::factory()->published()->create(['title' => 'Live announcement']);
        Announcement::factory()->create(['title' => 'Draft announcement']);

        $this->getJson('/api/public/announcements')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonFragment(['title' => 'Live announcement'])
            ->assertJsonMissing(['title' => 'Draft announcement']);
    }

    public function test_announcements_featured_first(): void
    {
        Announcement::factory()->published()->create(['title' => 'Regular', 'featured' => false]);
        Announcement::factory()->published()->create(['title' => 'Featured', 'featured' => true]);

        $this->getJson('/api/public/announcements')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Featured');
    }
}
