<?php

namespace Tests\Feature;

use App\Models\CmsContent;
use App\Models\StaffUser;
use App\Services\CmsContentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecureCrmCmsTest extends TestCase
{
    use RefreshDatabase;

    public function test_cms_index_renders_sections_for_content_manager(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();

        $this->actingAs($staff, 'staff')
            ->get('/securecrm/cms')
            ->assertOk()
            ->assertSee('Website CMS')
            ->assertSee('Homepage')
            ->assertSee('Features');
    }

    public function test_cms_is_forbidden_without_cms_view_permission(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/cms')
            ->assertForbidden();
    }

    public function test_create_is_forbidden_without_cms_edit_permission(): void
    {
        $viewer = StaffUser::factory()
            ->role('content_manager')
            ->withPermissions(['cms.view'])
            ->create();

        $this->actingAs($viewer, 'staff')
            ->get('/securecrm/cms/create?section=features')
            ->assertForbidden();
    }

    public function test_content_is_created_as_draft_with_revision(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();

        $response = $this->actingAs($staff, 'staff')
            ->post('/securecrm/cms?section=features', [
                'title' => 'New Feature',
                'content' => [
                    'title' => 'New Feature',
                    'description' => 'A brand new feature',
                    'icon' => 'Sparkles',
                    'gradient' => 'from-indigo-500/20 to-violet-500/20',
                    'icon_color' => 'text-indigo-500',
                ],
                'sort_order' => 1,
            ]);

        $response->assertRedirect();

        $item = CmsContent::where('section', 'features')->where('title', 'New Feature')->first();
        $this->assertNotNull($item);
        $this->assertSame('draft', $item->state);
        $this->assertSame('new-feature', $item->slug);
        $this->assertSame(1, $item->revisions()->count());
        $this->assertSame('Created', $item->revisions()->first()->note);
    }

    public function test_slug_is_unique_within_section(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();

        CmsContent::factory()->inSection('features')->create(['slug' => 'dupe', 'title' => 'Dupe']);
        CmsContent::factory()->inSection('blog')->create(['slug' => 'dupe', 'title' => 'Dupe blog']);

        $this->actingAs($staff, 'staff')
            ->post('/securecrm/cms?section=features', [
                'title' => 'Dupe',
                'slug' => 'dupe',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('cms_content', ['section' => 'features', 'slug' => 'dupe-2']);
        // The blog section slug is untouched by the features collision.
        $this->assertDatabaseHas('cms_content', ['section' => 'blog', 'slug' => 'dupe']);
    }

    public function test_update_snapshots_previous_version_as_revision(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();
        $item = app(CmsContentService::class)->create('features', [
            'title' => 'Old',
            'content' => ['title' => 'Old', 'description' => 'Old description'],
        ], $staff);

        $this->actingAs($staff, 'staff')
            ->patch("/securecrm/cms/{$item->id}?section=features", [
                'title' => 'Old',
                'content' => ['title' => 'Old', 'description' => 'New description'],
            ])
            ->assertRedirect();

        $item->refresh();
        $this->assertSame('New description', $item->content['description']);
        $this->assertSame(2, $item->revisions()->count());
        $this->assertSame('Old description', $item->revisions()->where('revision_number', 1)->first()->content['description']);
    }

    public function test_restore_revision_reverts_content_and_is_reversible(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();
        $item = app(CmsContentService::class)->create('features', [
            'title' => 'Feature',
            'content' => ['title' => 'Feature', 'description' => 'v1'],
        ], $staff);
        $revision = $item->revisions()->first();

        app(CmsContentService::class)->update($item, [
            'title' => 'Feature',
            'content' => ['title' => 'Feature', 'description' => 'v2'],
        ], $staff);

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/cms/{$item->id}/revisions/{$revision->id}/restore?section=features")
            ->assertRedirect();

        $item->refresh();
        $this->assertSame('v1', $item->content['description']);
        // Restore snapshots the current state first, so v2 is recoverable.
        $this->assertSame(3, $item->revisions()->count());
    }

    public function test_update_keeps_unchanged_slug(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();
        $item = app(CmsContentService::class)->create('features', [
            'title' => 'Keep Slug',
        ], $staff);

        $this->actingAs($staff, 'staff')
            ->patch("/securecrm/cms/{$item->id}?section=features", [
                'title' => 'Keep Slug',
                'content' => ['title' => 'Keep Slug', 'description' => 'Tweaked'],
            ])
            ->assertRedirect();

        $item->refresh();
        $this->assertSame('keep-slug', $item->slug);
        $this->assertSame(2, $item->revisions()->count());
    }

    public function test_publish_unpublish_archive_restore_cycle(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();
        $item = CmsContent::factory()->inSection('features')->draft()->create();

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/cms/{$item->id}/publish?section=features")
            ->assertRedirect();
        $this->assertSame('published', $item->refresh()->state);
        $this->assertNotNull($item->published_at);

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/cms/{$item->id}/unpublish?section=features")
            ->assertRedirect();
        $this->assertSame('draft', $item->refresh()->state);

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/cms/{$item->id}/archive?section=features")
            ->assertRedirect();
        $this->assertSame('archived', $item->refresh()->state);

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/cms/{$item->id}/restore?section=features")
            ->assertRedirect();
        $this->assertSame('draft', $item->refresh()->state);
    }

    public function test_archived_content_cannot_be_published(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();
        $item = CmsContent::factory()->inSection('features')->archived()->create();

        $response = $this->actingAs($staff, 'staff')
            ->post("/securecrm/cms/{$item->id}/publish?section=features");

        $response->assertRedirect();
        $this->assertSame('archived', $item->refresh()->state);
    }

    public function test_publish_requires_cms_publish_permission(): void
    {
        $editor = StaffUser::factory()
            ->role('content_manager')
            ->withPermissions(['cms.view', 'cms.edit'])
            ->create();
        $item = CmsContent::factory()->inSection('features')->draft()->create();

        $this->actingAs($editor, 'staff')
            ->post("/securecrm/cms/{$item->id}/publish?section=features")
            ->assertForbidden();
        $this->assertSame('draft', $item->refresh()->state);
    }

    public function test_schedule_requires_future_date(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();
        $item = CmsContent::factory()->inSection('features')->draft()->create();

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/cms/{$item->id}/schedule?section=features", [
                'scheduled_at' => now()->subDay()->format('Y-m-d H:i'),
            ])
            ->assertSessionHasErrors('scheduled_at');
        $this->assertSame('draft', $item->refresh()->state);

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/cms/{$item->id}/schedule?section=features", [
                'scheduled_at' => now()->addDay()->format('Y-m-d H:i'),
            ])
            ->assertRedirect();
        $this->assertSame('scheduled', $item->refresh()->state);
    }

    public function test_scheduled_publish_command_publishes_cms_content(): void
    {
        CmsContent::factory()->inSection('features')->create([
            'state' => 'scheduled',
            'scheduled_at' => now()->subMinute(),
        ]);
        CmsContent::factory()->inSection('features')->create([
            'state' => 'scheduled',
            'scheduled_at' => now()->addDay(),
        ]);

        $this->artisan('support:publish-scheduled-help')->assertSuccessful();

        $this->assertSame(1, CmsContent::where('state', 'published')->count());
        $this->assertSame(1, CmsContent::where('state', 'scheduled')->count());
    }

    public function test_preview_renders_draft_with_not_live_banner(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();
        $item = CmsContent::factory()->inSection('features')->draft()->create([
            'content' => ['title' => 'Previewed Feature', 'description' => 'Shown'],
        ]);

        $this->actingAs($staff, 'staff')
            ->get("/securecrm/cms/{$item->id}/preview?section=features")
            ->assertOk()
            ->assertSee('Previewed Feature')
            ->assertSee('not yet live');
    }

    public function test_single_section_show_renders_content_fields(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();
        $item = CmsContent::factory()->inSection('features')->create([
            'content' => ['title' => 'Feature A', 'description' => 'Description A'],
        ]);

        $this->actingAs($staff, 'staff')
            ->get("/securecrm/cms/{$item->id}?section=features")
            ->assertOk()
            ->assertSee('Feature A')
            ->assertSee('Description A');
    }

    public function test_unknown_section_returns_404(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();

        $this->actingAs($staff, 'staff')
            ->get('/securecrm/cms?section=does-not-exist')
            ->assertNotFound();
    }
}
