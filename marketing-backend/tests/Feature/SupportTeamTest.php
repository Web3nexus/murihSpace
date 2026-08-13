<?php

namespace Tests\Feature;

use App\Models\AutomationRule;
use App\Models\StaffUser;
use App\Models\SupportTeam;
use App\Models\Ticket;
use App\Services\TeamService;
use App\Services\TicketAutomationEngine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SupportTeamTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['internal.token' => 'test-secret']);
    }

    private function teamPayload(): array
    {
        return [
            'name' => 'Billing',
            'description' => 'Invoice and refund issues.',
            'is_active' => 1,
            'sort_order' => 2,
        ];
    }

    // ── SecureCRM CRUD ────────────────────────────────────────────

    public function test_manager_can_view_teams_section(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $team = SupportTeam::factory()->create(['name' => 'Wallet & Payments']);

        $this->actingAs($manager, 'staff')
            ->get('/securecrm/teams')
            ->assertOk()
            ->assertSee('Wallet & Payments')
            ->assertSee('Agent availability');

        $this->actingAs($manager, 'staff')
            ->get('/securecrm/teams?edit='.$team->id)
            ->assertOk()
            ->assertSee('Wallet & Payments');
    }

    public function test_agent_without_permission_cannot_access_teams(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/teams')
            ->assertForbidden();
    }

    public function test_manager_can_create_team_with_members_and_lead(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $lead = StaffUser::factory()->role('support_agent')->create();
        $member = StaffUser::factory()->role('support_agent')->create();

        $payload = $this->teamPayload();
        $payload['member_ids'] = [$lead->id, $member->id];
        $payload['lead_ids'] = [$lead->id];

        $this->actingAs($manager, 'staff')
            ->post('/securecrm/teams', $payload)
            ->assertRedirect(route('securecrm.teams'))
            ->assertSessionHas('status');

        $team = SupportTeam::firstOrFail();
        $this->assertSame('Billing', $team->name);
        $this->assertSame($manager->id, $team->created_by);

        $this->assertSame(2, $team->members()->count());
        $this->assertTrue((bool) $team->members()->whereKey($lead->id)->first()->pivot->is_lead);
        $this->assertFalse((bool) $team->members()->whereKey($member->id)->first()->pivot->is_lead);
    }

    public function test_manager_can_update_toggle_and_delete_team(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $team = SupportTeam::factory()->create(['created_by' => $manager->id]);

        $this->actingAs($manager, 'staff')
            ->patch("/securecrm/teams/{$team->id}", ['name' => 'Renamed team', 'is_active' => 1])
            ->assertRedirect();

        $this->assertSame('Renamed team', $team->refresh()->name);

        $this->actingAs($manager, 'staff')
            ->post("/securecrm/teams/{$team->id}/toggle")
            ->assertRedirect();

        $this->assertFalse($team->refresh()->is_active);

        $this->actingAs($manager, 'staff')
            ->delete("/securecrm/teams/{$team->id}")
            ->assertRedirect();

        $this->assertDatabaseMissing('support_teams', ['id' => $team->id]);
    }

    // ── Load balancing ────────────────────────────────────────────

    public function test_next_available_picks_least_loaded_agent(): void
    {
        $busy = StaffUser::factory()->role('support_agent')->create();
        $idle = StaffUser::factory()->role('support_agent')->create();
        $offline = StaffUser::factory()->role('support_agent')->create(['is_available' => false]);

        $team = SupportTeam::factory()->create();
        $team->members()->attach([$busy->id, $idle->id, $offline->id]);

        foreach (range(1, 3) as $i) {
            Ticket::factory()->create(['assigned_agent_id' => $busy->id, 'status' => 'open']);
        }

        $pick = (new TeamService)->nextAvailable($team->fresh());

        $this->assertNotNull($pick);
        $this->assertSame($idle->id, $pick->id);
    }

    public function test_next_available_returns_null_when_all_unavailable(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create(['is_available' => false]);
        $team = SupportTeam::factory()->create();
        $team->members()->attach($agent->id);

        $this->assertNull((new TeamService)->nextAvailable($team->fresh()));
    }

    public function test_assign_next_available_sets_team_and_agent(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();
        $team = SupportTeam::factory()->create();
        $team->members()->attach($agent->id);

        $ticket = Ticket::factory()->create(['status' => 'new']);

        $assigned = (new TeamService)->assignNextAvailable($ticket->fresh(), $team->fresh());

        $this->assertSame($agent->id, $assigned->id);
        $ticket->refresh();
        $this->assertSame($team->id, $ticket->assigned_team_id);
        $this->assertSame($agent->id, $ticket->assigned_agent_id);
        $this->assertSame('open', $ticket->status);

        $this->assertDatabaseHas('ticket_events', [
            'ticket_id' => $ticket->id,
            'event' => 'assigned',
            'new_value' => (string) $agent->id,
        ]);
    }

    public function test_assign_next_available_queues_when_no_one_available(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create(['is_available' => false]);
        $team = SupportTeam::factory()->create();
        $team->members()->attach($agent->id);

        $ticket = Ticket::factory()->create(['status' => 'new']);

        $assigned = (new TeamService)->assignNextAvailable($ticket->fresh(), $team->fresh());

        $this->assertNull($assigned);
        $ticket->refresh();
        $this->assertSame($team->id, $ticket->assigned_team_id);
        $this->assertNull($ticket->assigned_agent_id);
    }

    public function test_manual_assign_team_records_event(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $team = SupportTeam::factory()->create();
        $ticket = Ticket::factory()->create(['status' => 'new']);

        (new TeamService)->assignTeam($ticket->fresh(), $team->fresh(), $manager);

        $ticket->refresh();
        $this->assertSame($team->id, $ticket->assigned_team_id);
        $this->assertSame('open', $ticket->status);

        $this->assertDatabaseHas('ticket_events', [
            'ticket_id' => $ticket->id,
            'event' => 'team_assigned',
            'new_value' => (string) $team->id,
        ]);
    }

    // ── Availability ──────────────────────────────────────────────

    public function test_availability_can_be_toggled(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($manager, 'staff')
            ->patch("/securecrm/agents/{$agent->id}/availability", ['is_available' => 0])
            ->assertRedirect()
            ->assertSessionHas('status');

        $this->assertFalse($agent->refresh()->is_available);

        $this->actingAs($manager, 'staff')
            ->patch("/securecrm/agents/{$agent->id}/availability", ['is_available' => 1])
            ->assertRedirect();

        $this->assertTrue($agent->refresh()->is_available);
    }

    // ── Queue + ticket wiring ─────────────────────────────────────

    public function test_team_queue_shows_open_tickets(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $team = SupportTeam::factory()->create();

        $open = Ticket::factory()->create(['assigned_team_id' => $team->id, 'status' => 'open']);
        $resolved = Ticket::factory()->create(['assigned_team_id' => $team->id, 'status' => 'resolved']);

        $this->actingAs($manager, 'staff')
            ->get("/securecrm/teams/{$team->id}/queue")
            ->assertOk()
            ->assertSee($open->ticket_number)
            ->assertDontSee($resolved->ticket_number);
    }

    public function test_ticket_index_can_filter_by_team(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $team = SupportTeam::factory()->create();
        $other = SupportTeam::factory()->create();

        $inTeam = Ticket::factory()->create(['assigned_team_id' => $team->id, 'status' => 'open']);
        $elsewhere = Ticket::factory()->create(['assigned_team_id' => $other->id, 'status' => 'open']);

        $this->actingAs($manager, 'staff')
            ->get('/securecrm/tickets?team='.$team->id)
            ->assertOk()
            ->assertSee($inTeam->ticket_number)
            ->assertDontSee($elsewhere->ticket_number);
    }

    public function test_ticket_show_offers_team_assign_controls(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $team = SupportTeam::factory()->create(['name' => 'Billing']);
        $ticket = Ticket::factory()->create(['status' => 'open']);

        $this->actingAs($manager, 'staff')
            ->get("/securecrm/tickets/{$ticket->id}")
            ->assertOk()
            ->assertSee('Billing');
    }

    public function test_automation_assign_team_requires_active_team(): void
    {
        $team = SupportTeam::factory()->create();
        $disabled = SupportTeam::factory()->disabled()->create();

        $ticket = Ticket::factory()->create(['status' => 'new']);

        $rule = AutomationRule::factory()->create([
            'conditions' => [['field' => 'status', 'operator' => 'equals', 'value' => 'new']],
            'actions' => [['type' => 'assign_team', 'value' => (string) $disabled->id]],
        ]);

        (new TicketAutomationEngine)->apply($ticket->fresh(), 'created');

        $this->assertNull($ticket->refresh()->assigned_team_id);

        $rule->update(['actions' => [['type' => 'assign_team', 'value' => (string) $team->id]]]);
        (new TicketAutomationEngine)->apply($ticket->fresh(), 'created');

        $this->assertSame($team->id, $ticket->refresh()->assigned_team_id);
        $this->assertDatabaseHas('ticket_events', [
            'ticket_id' => $ticket->id,
            'event' => 'automation_team',
        ]);
    }
}
