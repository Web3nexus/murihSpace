<?php

namespace Tests\Feature;

use App\Models\AutomationRule;
use App\Models\AutomationRuleLog;
use App\Models\StaffUser;
use App\Models\SupportTeam;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Services\TicketAutomationEngine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AutomationRuleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['internal.token' => 'test-secret']);
    }

    private function staffPayload(): array
    {
        return [
            'name' => 'Route billing tickets',
            'description' => 'Send billing to the billing queue.',
            'trigger' => 'created',
            'sort_order' => 10,
            'enabled' => 1,
            'stop_after_match' => 1,
            'conditions' => [
                ['field' => 'category', 'operator' => 'equals', 'value' => 'Billing'],
            ],
            'actions' => [
                ['type' => 'set_priority', 'value' => 'critical'],
            ],
        ];
    }

    // ── SecureCRM CRUD ────────────────────────────────────────────

    public function test_manager_can_view_automation_section(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $rule = AutomationRule::factory()->create(['created_by' => $manager->id]);

        $this->actingAs($manager, 'staff')
            ->get('/securecrm/automation')
            ->assertOk()
            ->assertSee('Rules');

        $this->actingAs($manager, 'staff')
            ->get('/securecrm/automation?edit='.$rule->id)
            ->assertOk()
            ->assertSee($rule->name);
    }

    public function test_agent_without_permission_cannot_access_automation(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/automation')
            ->assertForbidden();
    }

    public function test_manager_can_create_rule(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();

        $this->actingAs($manager, 'staff')
            ->post('/securecrm/automation', $this->staffPayload())
            ->assertRedirect()
            ->assertSessionHas('status');

        $this->assertDatabaseHas('automation_rules', [
            'name' => 'Route billing tickets',
            'trigger' => 'created',
            'sort_order' => 10,
            'enabled' => true,
            'created_by' => $manager->id,
        ]);

        $rule = AutomationRule::firstOrFail();
        $this->assertSame('critical', $rule->actions[0]['value']);
        $this->assertSame('Billing', $rule->conditions[0]['value']);
    }

    public function test_create_rule_rejects_unknown_action(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();

        $payload = $this->staffPayload();
        $payload['actions'] = [['type' => 'teleport_ticket', 'value' => 'mars']];

        $this->actingAs($manager, 'staff')
            ->post('/securecrm/automation', $payload)
            ->assertSessionHasErrors('actions.0.type');

        $this->assertSame(0, AutomationRule::count());
    }

    public function test_missing_condition_value_is_rejected(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();

        $payload = $this->staffPayload();
        $payload['conditions'] = [['field' => 'priority', 'operator' => 'equals', 'value' => '']];

        $this->actingAs($manager, 'staff')
            ->post('/securecrm/automation', $payload)
            ->assertSessionHasErrors('conditions.0.value');

        $this->assertSame(0, AutomationRule::count());
    }

    public function test_manager_can_toggle_and_delete_rule(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $rule = AutomationRule::factory()->create(['created_by' => $manager->id]);

        $this->actingAs($manager, 'staff')
            ->post("/securecrm/automation/{$rule->id}/toggle")
            ->assertRedirect();

        $this->assertFalse($rule->refresh()->enabled);

        $this->actingAs($manager, 'staff')
            ->delete("/securecrm/automation/{$rule->id}")
            ->assertRedirect();

        $this->assertDatabaseMissing('automation_rules', ['id' => $rule->id]);
    }

    public function test_technical_support_can_manage_automation(): void
    {
        $technical = StaffUser::factory()->role('technical_support')->create();

        $this->actingAs($technical, 'staff')
            ->post('/securecrm/automation', $this->staffPayload())
            ->assertRedirect();

        $this->assertSame(1, AutomationRule::count());
    }

    public function test_preview_reports_whether_rule_would_match(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $rule = AutomationRule::factory()->create([
            'conditions' => [['field' => 'priority', 'operator' => 'equals', 'value' => 'critical']],
            'actions' => [['type' => 'set_status', 'value' => 'open']],
        ]);

        $match = Ticket::factory()->create(['priority' => 'critical']);
        $noMatch = Ticket::factory()->create(['priority' => 'low']);

        $this->actingAs($manager, 'staff')
            ->post("/securecrm/automation/{$rule->id}/preview", ['ticket_id' => $match->id])
            ->assertRedirect()
            ->assertSessionHas('status', "Rule \"{$rule->name}\" would match ticket {$match->ticket_number}.");

        $this->actingAs($manager, 'staff')
            ->post("/securecrm/automation/{$rule->id}/preview", ['ticket_id' => $noMatch->id])
            ->assertSessionHas('status', "Rule \"{$rule->name}\" would NOT match ticket {$noMatch->ticket_number}.");
    }

    // ── Engine evaluation ─────────────────────────────────────────

    public function test_keyword_rule_escalates_and_assigns_ticket(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $rule = AutomationRule::factory()->create([
            'conditions' => [['field' => 'keyword', 'operator' => 'contains', 'value' => 'withdrawal failed']],
            'actions' => [
                ['type' => 'set_priority', 'value' => 'critical'],
                ['type' => 'assign_agent', 'value' => $agent->id],
                ['type' => 'add_note', 'value' => 'Escalated by automation: withdrawal failure.'],
            ],
        ]);

        $ticket = Ticket::factory()->create([
            'subject' => 'Money missing',
            'description' => 'My withdrawal failed and nothing landed in my bank.',
            'priority' => 'normal',
            'status' => 'new',
        ]);

        $results = (new TicketAutomationEngine)->apply($ticket, 'created');

        $this->assertTrue($results[0]['matched']);
        $this->assertSame(['set_priority', 'assign_agent', 'add_note'], $results[0]['actions']);

        $this->assertSame('critical', $ticket->fresh()->priority);
        $this->assertSame($agent->id, $ticket->fresh()->assigned_agent_id);

        $this->assertSame(1, $rule->fresh()->times_triggered);
        $this->assertNotNull($rule->fresh()->last_triggered_at);

        $this->assertDatabaseHas('automation_rule_logs', [
            'rule_id' => $rule->id,
            'matched' => true,
        ]);
        $this->assertSame(1, $ticket->messages()->where('type', 'internal_note')->count());
    }

    public function test_category_rule_assigns_team(): void
    {
        $team = SupportTeam::factory()->create(['is_active' => true]);

        $rule = AutomationRule::factory()->create([
            'conditions' => [['field' => 'category', 'operator' => 'equals', 'value' => 'Billing']],
            'actions' => [['type' => 'assign_team', 'value' => (string) $team->id]],
        ]);

        $category = TicketCategory::factory()->create(['name' => 'Billing']);
        $ticket = Ticket::factory()->create([
            'category_id' => $category->id,
            'priority' => 'normal',
        ]);

        (new TicketAutomationEngine)->apply($ticket, 'created');

        $this->assertSame($team->id, $ticket->fresh()->assigned_team_id);
    }

    public function test_disabled_rule_is_skipped(): void
    {
        $rule = AutomationRule::factory()->disabled()->create([
            'conditions' => [['field' => 'status', 'operator' => 'equals', 'value' => 'new']],
            'actions' => [['type' => 'set_priority', 'value' => 'urgent']],
        ]);

        $ticket = Ticket::factory()->create(['status' => 'new', 'priority' => 'normal']);

        $results = (new TicketAutomationEngine)->apply($ticket, 'created');

        $this->assertSame([], $results);
        $this->assertSame('normal', $ticket->fresh()->priority);
        $this->assertSame(0, AutomationRuleLog::count());
    }

    public function test_unmatched_rule_is_audited(): void
    {
        $rule = AutomationRule::factory()->create([
            'conditions' => [['field' => 'priority', 'operator' => 'equals', 'value' => 'critical']],
            'actions' => [['type' => 'set_status', 'value' => 'open']],
        ]);

        $ticket = Ticket::factory()->create(['priority' => 'low']);

        (new TicketAutomationEngine)->apply($ticket, 'created');

        $this->assertDatabaseHas('automation_rule_logs', [
            'rule_id' => $rule->id,
            'matched' => false,
            'actions' => null,
        ]);
        $this->assertSame(0, $rule->fresh()->times_triggered);
        $this->assertSame('low', $ticket->fresh()->priority);
    }

    public function test_rules_run_in_order_and_stop_after_match(): void
    {
        AutomationRule::factory()->create([
            'name' => 'First',
            'sort_order' => 1,
            'stop_after_match' => true,
            'conditions' => [['field' => 'status', 'operator' => 'equals', 'value' => 'new']],
            'actions' => [['type' => 'set_priority', 'value' => 'high']],
        ]);
        AutomationRule::factory()->create([
            'name' => 'Second',
            'sort_order' => 2,
            'stop_after_match' => true,
            'conditions' => [['field' => 'status', 'operator' => 'equals', 'value' => 'new']],
            'actions' => [['type' => 'set_priority', 'value' => 'urgent']],
        ]);

        $ticket = Ticket::factory()->create(['status' => 'new', 'priority' => 'normal']);

        $results = (new TicketAutomationEngine)->apply($ticket, 'created');

        $this->assertCount(1, $results);
        $this->assertSame('First', $results[0]['rule']->name);
        $this->assertSame('high', $ticket->fresh()->priority);
    }

    public function test_all_rules_run_when_stop_after_match_is_off(): void
    {
        $team = SupportTeam::factory()->create(['is_active' => true]);

        AutomationRule::factory()->create([
            'name' => 'A',
            'sort_order' => 1,
            'stop_after_match' => false,
            'conditions' => [['field' => 'status', 'operator' => 'equals', 'value' => 'new']],
            'actions' => [['type' => 'set_priority', 'value' => 'high']],
        ]);
        AutomationRule::factory()->create([
            'name' => 'B',
            'sort_order' => 2,
            'stop_after_match' => false,
            'conditions' => [['field' => 'status', 'operator' => 'equals', 'value' => 'new']],
            'actions' => [['type' => 'assign_team', 'value' => (string) $team->id]],
        ]);

        $ticket = Ticket::factory()->create(['status' => 'new', 'priority' => 'normal']);

        $results = (new TicketAutomationEngine)->apply($ticket, 'created');

        $this->assertCount(2, $results);
        $this->assertSame('high', $ticket->fresh()->priority);
        $this->assertSame($team->id, $ticket->fresh()->assigned_team_id);
    }

    public function test_updated_trigger_only_runs_on_updated(): void
    {
        $rule = AutomationRule::factory()->onUpdated()->create([
            'conditions' => [['field' => 'status', 'operator' => 'equals', 'value' => 'open']],
            'actions' => [['type' => 'set_priority', 'value' => 'urgent']],
        ]);

        $ticket = Ticket::factory()->create(['status' => 'open', 'priority' => 'normal']);

        // 'created' trigger must not run the 'updated'-only rule.
        (new TicketAutomationEngine)->apply($ticket, 'created');
        $this->assertSame('normal', $ticket->fresh()->priority);
        $this->assertSame(0, AutomationRuleLog::count());

        (new TicketAutomationEngine)->apply($ticket, 'updated');
        $this->assertSame('urgent', $ticket->fresh()->priority);
        $this->assertSame(1, $rule->fresh()->times_triggered);
    }

    // ── Hooks ─────────────────────────────────────────────────────

    public function test_public_ticket_creation_triggers_automation(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        AutomationRule::factory()->create([
            'conditions' => [['field' => 'keyword', 'operator' => 'contains', 'value' => 'withdrawal']],
            'actions' => [
                ['type' => 'assign_agent', 'value' => $agent->id],
                ['type' => 'set_priority', 'value' => 'critical'],
            ],
        ]);

        $this->postJson('/api/customer/tickets', [
            'subject' => 'Withdrawal missing',
            'description' => 'My withdrawal never arrived.',
        ], ['X-Internal-Token' => 'test-secret', 'X-Customer-Email' => 'customer@example.com'])
            ->assertStatus(201);

        $ticket = Ticket::firstOrFail();
        $this->assertSame('critical', $ticket->priority);
        $this->assertSame($agent->id, $ticket->assigned_agent_id);
        $this->assertSame(1, AutomationRuleLog::where('ticket_id', $ticket->id)->count());
    }

    public function test_staff_created_ticket_triggers_automation(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $billing = TicketCategory::factory()->create(['name' => 'Billing']);

        AutomationRule::factory()->create([
            'conditions' => [['field' => 'category', 'operator' => 'equals', 'value' => 'Billing']],
            'actions' => [['type' => 'set_priority', 'value' => 'urgent']],
        ]);

        $this->actingAs($manager, 'staff')
            ->post('/securecrm/tickets', [
                'subject' => 'Double charge',
                'description' => 'Charged twice this month.',
                'category_id' => $billing->id,
                'priority' => 'normal',
                'assigned_agent_id' => '',
            ])
            ->assertRedirect();

        $ticket = Ticket::firstOrFail();
        $this->assertSame('urgent', $ticket->priority);
    }

    public function test_support_event_ticket_triggers_automation(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        AutomationRule::factory()->create([
            'conditions' => [['field' => 'channel', 'operator' => 'equals', 'value' => 'system']],
            'actions' => [['type' => 'assign_agent', 'value' => $agent->id]],
        ]);

        $this->postJson('/api/internal/events', [
            'event_id' => 'evt-auto-1',
            'event_key' => 'kyc.rejected',
            'customer_email' => 'mom@example.com',
            'actor_type' => 'kyc',
            'actor_reference' => '42',
            'payload' => ['reason' => 'Blurry document'],
        ], [
            'X-Internal-Token' => 'test-secret',
            'X-Timestamp' => (string) now()->getTimestamp(),
            'X-Nonce' => bin2hex(random_bytes(16)),
        ])->assertStatus(201);

        $ticket = Ticket::firstOrFail();
        $this->assertSame($agent->id, $ticket->assigned_agent_id);
        $this->assertSame(1, AutomationRuleLog::where('ticket_id', $ticket->id)->count());
        $this->assertDatabaseHas('automation_rule_logs', [
            'rule_id' => AutomationRule::first()->id,
            'matched' => true,
        ]);
    }

    public function test_updated_rules_run_on_status_change(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();

        AutomationRule::factory()->onUpdated()->create([
            'conditions' => [['field' => 'status', 'operator' => 'equals', 'value' => 'open']],
            'actions' => [['type' => 'notify_staff', 'value' => $manager->id]],
        ]);

        $ticket = Ticket::factory()->create(['status' => 'new', 'priority' => 'normal']);

        $this->actingAs($manager, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/status", ['status' => 'open'])
            ->assertRedirect();

        $this->assertDatabaseHas('ticket_events', [
            'ticket_id' => $ticket->id,
            'event' => 'automation_notify',
        ]);
        $this->assertSame(1, AutomationRuleLog::where('matched', true)->count());
    }
}
