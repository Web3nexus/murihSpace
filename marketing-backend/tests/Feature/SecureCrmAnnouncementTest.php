<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\StaffUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecureCrmAnnouncementTest extends TestCase
{
    use RefreshDatabase;

    public function test_announcements_index_renders_for_manager(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();
        Announcement::factory()->create(['title' => 'Site maintenance']);

        $this->actingAs($staff, 'staff')
            ->get('/securecrm/announcements')
            ->assertOk()
            ->assertSee('Site maintenance')
            ->assertSee('Announcements');
    }

    public function test_announcements_is_forbidden_without_view_permission(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/announcements')
            ->assertForbidden();
    }

    public function test_announcement_is_created_as_draft(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();

        $this->actingAs($staff, 'staff')
            ->post('/securecrm/announcements', [
                'title' => 'New feature shipped',
                'body' => 'We shipped something great.',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('announcements', [
            'title' => 'New feature shipped',
            'state' => 'draft',
        ]);
    }

    public function test_announcement_manage_required_for_create(): void
    {
        $viewer = StaffUser::factory()
            ->role('content_manager')
            ->withPermissions(['announcement.view'])
            ->create();

        $this->actingAs($viewer, 'staff')
            ->get('/securecrm/announcements/create')
            ->assertForbidden();
    }

    public function test_publish_unpublish_schedule_archive_restore_delete(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();
        $announcement = Announcement::factory()->create(['title' => 'Cycle me']);

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/announcements/{$announcement->id}/publish")
            ->assertRedirect();
        $this->assertSame('published', $announcement->refresh()->state);

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/announcements/{$announcement->id}/unpublish")
            ->assertRedirect();
        $this->assertSame('draft', $announcement->refresh()->state);

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/announcements/{$announcement->id}/schedule", [
                'scheduled_at' => now()->addDay()->format('Y-m-d H:i'),
            ])
            ->assertRedirect();
        $this->assertSame('scheduled', $announcement->refresh()->state);

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/announcements/{$announcement->id}/archive")
            ->assertRedirect();
        $this->assertSame('archived', $announcement->refresh()->state);

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/announcements/{$announcement->id}/restore")
            ->assertRedirect();
        $this->assertSame('draft', $announcement->refresh()->state);

        $this->actingAs($staff, 'staff')
            ->delete("/securecrm/announcements/{$announcement->id}")
            ->assertRedirect();
        $this->assertDatabaseMissing('announcements', ['id' => $announcement->id]);
    }

    public function test_archived_announcement_cannot_be_published(): void
    {
        $staff = StaffUser::factory()->role('content_manager')->create();
        $announcement = Announcement::factory()->create(['state' => 'archived']);

        $this->actingAs($staff, 'staff')
            ->post("/securecrm/announcements/{$announcement->id}/publish")
            ->assertRedirect();
        $this->assertSame('archived', $announcement->refresh()->state);
    }
}
