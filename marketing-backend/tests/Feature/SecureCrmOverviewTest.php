<?php

namespace Tests\Feature;

use App\Models\StaffUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecureCrmOverviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_overview_page_renders_for_authenticated_staff(): void
    {
        $staff = StaffUser::factory()->admin()->create();

        $this->actingAs($staff, 'staff')
            ->get('/securecrm/overview')
            ->assertOk()
            ->assertSee('Overview')
            ->assertSee('Published articles')
            ->assertSee('SecureCRM');
    }

    public function test_overview_shows_real_help_kpis(): void
    {
        $staff = StaffUser::factory()->admin()->create();
        $this->artisan('support:migrate-help-center');

        $this->actingAs($staff, 'staff')
            ->get('/securecrm/overview')
            ->assertOk()
            ->assertSee('22'); // 22 published articles
    }

    public function test_help_center_renders_as_real_section(): void
    {
        $staff = StaffUser::factory()->admin()->create();

        $this->actingAs($staff, 'staff')
            ->get('/securecrm/help')
            ->assertOk()
            ->assertSee('Help Center')
            ->assertSee('New article')
            ->assertSee('Workflow')
            ->assertDontSee('Coming in a later sprint');
    }

    public function test_layout_shows_navigation(): void
    {
        $staff = StaffUser::factory()->admin()->create();

        $this->actingAs($staff, 'staff')
            ->get('/securecrm/overview')
            ->assertOk()
            ->assertSee('Tickets')
            ->assertSee('Customers')
            ->assertSee('Audit Logs')
            ->assertSee('Settings');
    }
}
