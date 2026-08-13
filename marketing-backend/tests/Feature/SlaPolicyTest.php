<?php

namespace Tests\Feature;

use App\Models\AutomationRule;
use App\Models\SlaPolicy;
use App\Models\StaffUser;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Services\BusinessTime;
use App\Services\SlaService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SlaPolicyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['internal.token' => 'test-secret']);
    }

    private function policyPayload(): array
    {
        return [
            'name' => 'Critical — respond fast',
            'description' => 'Highest severity.',
            'priority' => 'critical',
            'first_response_target' => 10,
            'next_response_target' => 30,
            'resolution_target' => 120,
            'business_hours' => 0,
            'weekends' => 1,
            'holidays' => 0,
            'holiday_dates' => '2026-12-25, 2026-01-01',
            'pause_on_customer' => 1,
            'enabled' => 1,
        ];
    }

    // ── SecureCRM CRUD ────────────────────────────────────────────

    public function test_manager_can_view_slas_section(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $policy = SlaPolicy::factory()->create([
            'name' => 'Urgent queue',
            'priority' => 'urgent',
            'created_by' => $manager->id,
        ]);

        $this->actingAs($manager, 'staff')
            ->get('/securecrm/slas')
            ->assertOk()
            ->assertSee('Policies')
            ->assertSee('Urgent queue');

        $this->actingAs($manager, 'staff')
            ->get('/securecrm/slas?edit='.$policy->id)
            ->assertOk()
            ->assertSee('Urgent queue');
    }

    public function test_agent_without_permission_cannot_access_slas(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/slas')
            ->assertForbidden();
    }

    public function test_manager_can_create_policy(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();

        $this->actingAs($manager, 'staff')
            ->post('/securecrm/slas', $this->policyPayload())
            ->assertRedirect()
            ->assertRedirect(route('securecrm.slas'))
            ->assertSessionHas('status');

        $policy = SlaPolicy::firstOrFail();
        $this->assertSame('critical', $policy->priority);
        $this->assertSame(10, $policy->first_response_target);
        $this->assertSame(120, $policy->resolution_target);
        $this->assertTrue($policy->pause_on_customer);
        $this->assertTrue($policy->enabled);
        $this->assertSame($manager->id, $policy->created_by);
        $this->assertSame(['2026-12-25', '2026-01-01'], $policy->holidayDates());
    }

    public function test_create_rejects_unknown_priority(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();

        $payload = $this->policyPayload();
        $payload['priority'] = 'catastrophic';

        $this->actingAs($manager, 'staff')
            ->post('/securecrm/slas', $payload)
            ->assertSessionHasErrors('priority');

        $this->assertSame(0, SlaPolicy::count());
    }

    public function test_create_rejects_zero_target(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();

        $payload = $this->policyPayload();
        $payload['first_response_target'] = 0;

        $this->actingAs($manager, 'staff')
            ->post('/securecrm/slas', $payload)
            ->assertSessionHasErrors('first_response_target');

        $this->assertSame(0, SlaPolicy::count());
    }

    public function test_manager_can_update_toggle_and_delete_policy(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $policy = SlaPolicy::factory()->create(['created_by' => $manager->id]);

        $this->actingAs($manager, 'staff')
            ->patch("/securecrm/slas/{$policy->id}", ['name' => 'Renamed', 'priority' => 'high', 'first_response_target' => 45, 'resolution_target' => 240, 'enabled' => true])
            ->assertRedirect();

        $policy->refresh();
        $this->assertSame('Renamed', $policy->name);
        $this->assertSame(45, $policy->first_response_target);

        $this->actingAs($manager, 'staff')
            ->post("/securecrm/slas/{$policy->id}/toggle")
            ->assertRedirect();

        $this->assertFalse($policy->refresh()->enabled);

        $this->actingAs($manager, 'staff')
            ->delete("/securecrm/slas/{$policy->id}")
            ->assertRedirect();

        $this->assertDatabaseMissing('sla_policies', ['id' => $policy->id]);
    }

    // ── BusinessTime windows ──────────────────────────────────────

    public function test_business_hours_weekend_and_holiday_are_counted_correctly(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-10 10:00:00', 'UTC'));

        $policy = SlaPolicy::factory()->businessHours()->create([
            'holidays' => true,
            'holiday_dates' => ['2026-08-10'],
            'first_response_target' => 60,
            'resolution_target' => 480,
        ]);

        // Monday 10 Aug is a configured holiday → nothing counts that day.
        $this->assertSame(
            0,
            BusinessTime::secondsBetween(
                Carbon::parse('2026-08-10 09:00:00', 'UTC'),
                Carbon::parse('2026-08-10 17:00:00', 'UTC'),
                $policy,
            ),
        );

        // Business hours only: Tue 09:00 → Wed 11:00 = 8h + 2h = 10h.
        $this->assertSame(
            36000,
            BusinessTime::secondsBetween(
                Carbon::parse('2026-08-11 09:00:00', 'UTC'),
                Carbon::parse('2026-08-12 11:00:00', 'UTC'),
                $policy,
            ),
        );

        // Weekend (Sat 15 Aug) must be excluded.
        $this->assertSame(
            28800,
            BusinessTime::secondsBetween(
                Carbon::parse('2026-08-14 09:00:00', 'UTC'),
                Carbon::parse('2026-08-17 09:00:00', 'UTC'),
                $policy,
            ),
        );
    }

    public function test_round_the_clock_policy_counts_every_second(): void
    {
        $policy = SlaPolicy::factory()->create(['weekends' => true]);

        $this->assertGreaterThanOrEqual(
            86399,
            BusinessTime::secondsBetween(
                Carbon::parse('2026-08-14 00:00:00', 'UTC'),
                Carbon::parse('2026-08-15 00:00:00', 'UTC'),
                $policy,
            ),
        );
    }

    // ── SlaService snapshots ──────────────────────────────────────

    public function test_snapshot_records_remaining_and_progress(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-10 12:00:00', 'UTC'));

        $policy = SlaPolicy::factory()->create([
            'priority' => 'normal',
            'first_response_target' => 60,
            'resolution_target' => 120,
            'enabled' => true,
        ]);

        $ticket = Ticket::factory()->create([
            'priority' => 'normal',
            'status' => 'new',
            'created_at' => Carbon::parse('2026-08-10 11:30:00', 'UTC'),
        ]);

        $sla = (new SlaService);

        $this->assertSame($policy->id, $sla->assignPolicy($ticket)->id);
        $snapshot = $sla->snapshot($ticket->fresh());

        $this->assertNotNull($snapshot);
        $this->assertSame('remaining', $snapshot['status']);
        $this->assertFalse($snapshot['paused']);
        $this->assertSame('remaining', $snapshot['resolution']['status']);
        // 30 minutes consumed of a 120 minute target → 90 minutes (5400s) left.
        $this->assertSame(5400, $snapshot['resolution']['remaining']);
        $this->assertSame(25, $snapshot['resolution']['progress']);
    }

    public function test_snapshot_reports_breached_when_over_target(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-10 12:00:00', 'UTC'));

        $policy = SlaPolicy::factory()->create(['priority' => 'low', 'first_response_target' => 5, 'resolution_target' => 30]);
        $ticket = Ticket::factory()->create([
            'priority' => 'low',
            'status' => 'new',
            'created_at' => Carbon::parse('2026-08-10 10:00:00', 'UTC'),
        ]);

        $sla = new SlaService;
        $sla->assignPolicy($ticket);

        $snapshot = $sla->snapshot($ticket->fresh());

        $this->assertNotNull($snapshot);
        $this->assertSame('breached', $snapshot['status']);
        $this->assertSame('breached', $snapshot['resolution']['status']);
    }

    public function test_snapshot_completes_after_first_response(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-10 12:00:00', 'UTC'));

        $policy = SlaPolicy::factory()->create(['priority' => 'high', 'first_response_target' => 60, 'resolution_target' => 120]);
        $ticket = Ticket::factory()->create([
            'priority' => 'high',
            'status' => 'open',
            'created_at' => Carbon::parse('2026-08-10 11:00:00', 'UTC'),
            'first_response_at' => Carbon::parse('2026-08-10 11:20:00', 'UTC'),
        ]);

        $sla = new SlaService;
        $sla->assignPolicy($ticket);

        $snapshot = $sla->snapshot($ticket->fresh());

        $this->assertNotNull($snapshot);
        $this->assertSame('completed', $snapshot['status']);
        $this->assertTrue($snapshot['completed']);
        $this->assertSame('completed', $snapshot['first_response']['status']);
    }

    public function test_snapshot_is_null_without_enabled_policy(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-10 12:00:00', 'UTC'));

        $policy = SlaPolicy::factory()->disabled()->create(['priority' => 'normal']);
        $ticket = Ticket::factory()->create(['priority' => 'normal', 'status' => 'new']);

        $sla = new SlaService;
        $sla->assignPolicy($ticket);

        $this->assertNull($sla->snapshot($ticket->fresh()));
        $this->assertNull($sla->assignPolicy($ticket));
    }

    public function test_pause_and_resume_accumulate_paused_seconds(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-10 11:00:00', 'UTC'));

        $policy = SlaPolicy::factory()->create(['priority' => 'normal']);
        $ticket = Ticket::factory()->create([
            'priority' => 'normal',
            'status' => 'new',
            'created_at' => Carbon::parse('2026-08-10 10:00:00', 'UTC'),
        ]);

        $sla = new SlaService;
        $sla->assignPolicy($ticket);

        $sla->pause($ticket);
        $this->assertNotNull($ticket->fresh()->sla_paused_at);

        // While paused, the clock stands still.
        $pausedSnapshot = $sla->snapshot($ticket->fresh());
        $this->assertSame('paused', $pausedSnapshot['status']);
        $this->assertTrue($pausedSnapshot['paused']);

        // 30 minutes pass while paused.
        Carbon::setTestNow(Carbon::parse('2026-08-10 11:30:00', 'UTC'));
        $sla->resume($ticket->fresh());

        $ticket = $ticket->fresh();
        $this->assertNull($ticket->sla_paused_at);
        $this->assertSame(1800, $ticket->sla_paused_seconds);

        // Consumed time excludes the 30 paused minutes: 10:00→11:30 = 1.5h counted, minus 30m paused = 1h.
        $this->assertSame(3600, $sla->consumedSeconds($ticket, Carbon::parse('2026-08-10 11:30:00', 'UTC')));
    }

    public function test_status_change_pauses_clock_when_waiting_on_customer(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-10 11:00:00', 'UTC'));

        $manager = StaffUser::factory()->role('support_manager')->create();
        $policy = SlaPolicy::factory()->pauseOnCustomer()->create(['priority' => 'normal']);
        $ticket = Ticket::factory()->create([
            'priority' => 'normal',
            'status' => 'open',
            'created_at' => Carbon::parse('2026-08-10 10:00:00', 'UTC'),
        ]);

        (new SlaService)->assignPolicy($ticket);

        $this->actingAs($manager, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/status", ['status' => 'pending_customer'])
            ->assertRedirect();

        $this->assertNotNull($ticket->fresh()->sla_paused_at);

        $this->actingAs($manager, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/status", ['status' => 'open'])
            ->assertRedirect();

        $this->assertNull($ticket->fresh()->sla_paused_at);
        $this->assertSame(0, (int) $ticket->fresh()->sla_paused_seconds);
    }

    public function test_status_change_does_not_pause_without_pause_on_customer(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-10 11:00:00', 'UTC'));

        $manager = StaffUser::factory()->role('support_manager')->create();
        $policy = SlaPolicy::factory()->create(['priority' => 'normal']); // pause_on_customer = false
        $ticket = Ticket::factory()->create([
            'priority' => 'normal',
            'status' => 'open',
            'created_at' => Carbon::parse('2026-08-10 10:00:00', 'UTC'),
        ]);

        (new SlaService)->assignPolicy($ticket);

        $this->actingAs($manager, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/status", ['status' => 'pending_customer'])
            ->assertRedirect();

        $this->assertNull($ticket->fresh()->sla_paused_at);
    }

    public function test_ticket_creation_assigns_policy_after_automation(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();

        // Automation downgrades priority, so the SLA policy assigned afterwards
        // must match the final (post-automation) priority.
        AutomationRule::factory()->create([
            'conditions' => [['field' => 'category', 'operator' => 'equals', 'value' => 'Billing']],
            'actions' => [['type' => 'set_priority', 'value' => 'low']],
        ]);

        $critical = SlaPolicy::factory()->forPriority('critical', 10, 120)->create();
        $low = SlaPolicy::factory()->forPriority('low', 1440, 2880)->create();

        $category = TicketCategory::factory()->create(['name' => 'Billing']);

        $this->actingAs($manager, 'staff')
            ->post('/securecrm/tickets', [
                'subject' => 'Double charge',
                'description' => 'Billing problem.',
                'category_id' => $category->id,
                'priority' => 'critical',
                'assigned_agent_id' => '',
            ])
            ->assertRedirect();

        $ticket = Ticket::firstOrFail();

        $this->assertSame('low', $ticket->priority);
        $this->assertSame($low->id, $ticket->sla_policy_id);
        $this->assertNotSame($critical->id, $ticket->sla_policy_id);
    }

    public function test_ticket_index_and_show_render_sla_state(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-10 12:00:00', 'UTC'));

        $manager = StaffUser::factory()->role('support_manager')->create();
        $policy = SlaPolicy::factory()->create(['priority' => 'normal']);

        $ticket = Ticket::factory()->create([
            'priority' => 'normal',
            'status' => 'new',
            'created_at' => Carbon::parse('2026-08-10 11:00:00', 'UTC'),
        ]);

        (new SlaService)->assignPolicy($ticket);

        $this->actingAs($manager, 'staff')
            ->get('/securecrm/tickets')
            ->assertOk()
            ->assertSee('Breached')
            ->assertSee($ticket->ticket_number);

        $this->actingAs($manager, 'staff')
            ->get("/securecrm/tickets/{$ticket->id}")
            ->assertOk()
            ->assertSee('SLA', false)
            ->assertSee('Resolution');
    }
}
