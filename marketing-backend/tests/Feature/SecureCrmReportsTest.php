<?php

namespace Tests\Feature;

use App\Models\HelpArticle;
use App\Models\HelpArticleFeedback;
use App\Models\SlaPolicy;
use App\Models\StaffUser;
use App\Models\Ticket;
use App\Models\TicketCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecureCrmReportsTest extends TestCase
{
    use RefreshDatabase;

    public function test_reports_page_renders_for_admin(): void
    {
        $staff = StaffUser::factory()->admin()->create();

        $this->actingAs($staff, 'staff')
            ->get('/securecrm/reports')
            ->assertOk()
            ->assertSee('Reports')
            ->assertSee('Open tickets')
            ->assertSee('Average first response');
    }

    public function test_reports_shows_ticket_metrics(): void
    {
        $staff = StaffUser::factory()->admin()->create();
        $category = TicketCategory::factory()->create(['name' => 'Billing']);

        Ticket::factory()->forUser()->open()->withCategory($category)
            ->create(['priority' => 'critical']);
        Ticket::factory()->forUser()->open()->withCategory($category)
            ->create(['priority' => 'critical']);

        $this->actingAs($staff, 'staff')
            ->get('/securecrm/reports')
            ->assertOk()
            ->assertSee('Critical')
            ->assertSee('Open tickets');
    }

    public function test_reports_reflects_sla_breaches(): void
    {
        $staff = StaffUser::factory()->admin()->create();
        $policy = SlaPolicy::factory()->create(['enabled' => true, 'first_response_target' => 1, 'resolution_target' => 60]);

        Ticket::factory()->forUser()->open()->create([
            'priority' => 'high',
            'sla_policy_id' => $policy->id,
            'created_at' => now()->subMinutes(30),
        ]);

        $this->actingAs($staff, 'staff')
            ->get('/securecrm/reports')
            ->assertOk()
            ->assertSee('SLA breaches');
    }

    public function test_reports_page_renders_with_no_data(): void
    {
        $staff = StaffUser::factory()->admin()->create();

        $this->actingAs($staff, 'staff')
            ->get('/securecrm/reports')
            ->assertOk()
            ->assertSee('No tickets yet')
            ->assertSee('0');
    }

    public function test_reports_shows_help_articles(): void
    {
        $staff = StaffUser::factory()->admin()->create();
        $article = HelpArticle::factory()->create();
        HelpArticleFeedback::create(['article_id' => $article->id, 'helpful' => true]);
        HelpArticleFeedback::create(['article_id' => $article->id, 'helpful' => false]);

        $this->actingAs($staff, 'staff')
            ->get('/securecrm/reports')
            ->assertOk()
            ->assertSee('Help Center')
            ->assertSee('Article views');
    }
}
