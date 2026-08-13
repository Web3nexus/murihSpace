<?php

namespace Tests\Feature;

use App\Models\StaffUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecureCrmPermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_support_agent_can_access_their_permitted_sections(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/tickets')
            ->assertOk();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/customers')
            ->assertOk();
    }

    public function test_support_agent_is_forbidden_from_privileged_sections(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        foreach (['audit', 'settings', 'reports', 'cms'] as $section) {
            $this->actingAs($agent, 'staff')
                ->get("/securecrm/{$section}")
                ->assertForbidden();
        }
    }

    public function test_help_editor_cannot_access_ticket_sections(): void
    {
        $editor = StaffUser::factory()->role('help_editor')->create();

        $this->actingAs($editor, 'staff')
            ->get('/securecrm/help')
            ->assertOk();

        $this->actingAs($editor, 'staff')
            ->get('/securecrm/tickets')
            ->assertForbidden();

        $this->actingAs($editor, 'staff')
            ->get('/securecrm/settings')
            ->assertForbidden();
    }

    public function test_custom_permission_list_overrides_role_defaults(): void
    {
        $agent = StaffUser::factory()
            ->role('support_agent')
            ->withPermissions(['audit.view'])
            ->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/audit')
            ->assertOk();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/tickets')
            ->assertForbidden();
    }

    public function test_admin_can_access_all_sections(): void
    {
        $admin = StaffUser::factory()->admin()->create();

        foreach (['tickets', 'audit', 'settings', 'reports', 'crm'] as $section) {
            $this->actingAs($admin, 'staff')
                ->get("/securecrm/{$section}")
                ->assertOk();
        }
    }

    public function test_nav_hides_sections_without_permission(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $response = $this->actingAs($agent, 'staff')->get('/securecrm/overview');

        $response->assertOk();
        $response->assertSee('Tickets');
        $response->assertDontSee('Audit Logs');
        $response->assertDontSee('Settings');
        $response->assertDontSee('Website CMS');
    }

    public function test_nav_shows_all_sections_for_admin(): void
    {
        $admin = StaffUser::factory()->admin()->create();

        $response = $this->actingAs($admin, 'staff')->get('/securecrm/overview');

        $response->assertOk();
        foreach (['Tickets', 'Customers', 'CRM', 'Help Center', 'Website CMS', 'Announcements', 'Reports', 'Audit Logs', 'Settings'] as $label) {
            $response->assertSee($label);
        }
    }
}
