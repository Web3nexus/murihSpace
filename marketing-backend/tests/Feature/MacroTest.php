<?php

namespace Tests\Feature;

use App\Models\Macro;
use App\Models\StaffUser;
use App\Models\SupportTeam;
use App\Models\Ticket;
use App\Models\TicketTag;
use App\Services\MacroService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MacroTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->actingAs(StaffUser::factory()->role('support_manager')->create(), 'staff');
    }

    public function test_manager_can_view_macros_page(): void
    {
        Macro::factory()->create(['name' => 'Payment confirmed']);

        $this->get('/securecrm/macros')
            ->assertOk()
            ->assertSee('Payment confirmed');
    }

    public function test_agent_without_macro_manage_is_forbidden(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/macros')
            ->assertForbidden();
    }

    public function test_manager_can_create_macro_with_actions(): void
    {
        $team = SupportTeam::factory()->create(['is_active' => true]);

        $this->post('/securecrm/macros', [
            'name' => 'KYC resubmission',
            'category' => 'Compliance',
            'body' => 'Please resubmit your documents.',
            'actions' => [
                ['type' => 'change_status', 'value' => 'pending_customer'],
                ['type' => 'add_tag', 'value' => 'kyc'],
                ['type' => 'assign_team', 'value' => (string) $team->id],
            ],
        ])->assertRedirect('/securecrm/macros');

        $this->assertDatabaseHas('macros', [
            'name' => 'KYC resubmission',
            'is_active' => true,
        ]);

        $macro = Macro::where('name', 'KYC resubmission')->first();
        $this->assertSame('pending_customer', $macro->actions[0]['value']);
        $this->assertSame('kyc', $macro->actions[1]['value']);
    }

    public function test_macro_without_actions_is_stored_with_null_actions(): void
    {
        $this->post('/securecrm/macros', [
            'name' => 'Plain reply',
            'body' => 'Thanks for contacting us.',
        ])->assertRedirect('/securecrm/macros');

        $this->assertDatabaseHas('macros', ['name' => 'Plain reply']);
        $this->assertNull(Macro::where('name', 'Plain reply')->first()->actions);
    }

    public function test_macro_cannot_use_unsafe_action_type(): void
    {
        $this->post('/securecrm/macros', [
            'name' => 'Refund attempt',
            'actions' => [
                ['type' => 'refund', 'value' => 'full'],
            ],
        ])->assertSessionHasErrors('actions.0.type');

        $this->assertDatabaseMissing('macros', ['name' => 'Refund attempt']);
    }

    public function test_manager_can_update_macro(): void
    {
        $macro = Macro::factory()->create(['name' => 'Old name']);

        $this->patch("/securecrm/macros/{$macro->id}", [
            'name' => 'New name',
            'body' => 'Updated body.',
            'actions' => [
                ['type' => 'change_priority', 'value' => 'urgent'],
            ],
        ])->assertRedirect('/securecrm/macros');

        $macro->refresh();
        $this->assertSame('New name', $macro->name);
        $this->assertSame('urgent', $macro->actions[0]['value']);
    }

    public function test_manager_can_toggle_macro(): void
    {
        $macro = Macro::factory()->create(['is_active' => true]);

        $this->post("/securecrm/macros/{$macro->id}/toggle")
            ->assertRedirect();

        $this->assertFalse($macro->fresh()->is_active);

        $this->post("/securecrm/macros/{$macro->id}/toggle")
            ->assertRedirect();

        $this->assertTrue($macro->fresh()->is_active);
    }

    public function test_manager_can_delete_macro(): void
    {
        $macro = Macro::factory()->create();

        $this->delete("/securecrm/macros/{$macro->id}")
            ->assertRedirect('/securecrm/macros');

        $this->assertDatabaseMissing('macros', ['id' => $macro->id]);
    }

    public function test_apply_macro_posts_reply_and_changes_fields(): void
    {
        $team = SupportTeam::factory()->create(['is_active' => true]);

        $macro = Macro::factory()->create([
            'name' => 'Billing follow-up',
            'body' => 'Here is a reply.',
            'actions' => [
                ['type' => 'change_status', 'value' => 'pending_customer'],
                ['type' => 'change_priority', 'value' => 'high'],
                ['type' => 'add_tag', 'value' => 'billing'],
                ['type' => 'assign_team', 'value' => (string) $team->id],
            ],
        ]);

        $ticket = Ticket::factory()->create(['status' => 'open', 'priority' => 'normal']);

        $this->post("/securecrm/tickets/{$ticket->id}/macro/{$macro->id}")
            ->assertRedirect();

        $ticket->refresh();
        $this->assertSame('pending_customer', $ticket->status);
        $this->assertSame('high', $ticket->priority);
        $this->assertSame($team->id, $ticket->assigned_team_id);

        $this->assertDatabaseHas('ticket_messages', [
            'ticket_id' => $ticket->id,
            'type' => 'reply',
            'body' => 'Here is a reply.',
        ]);
        $this->assertDatabaseHas('ticket_tags', [
            'ticket_id' => $ticket->id,
            'name' => 'billing',
        ]);
        $this->assertDatabaseHas('ticket_events', [
            'ticket_id' => $ticket->id,
            'event' => 'macro_applied',
            'new_value' => 'Billing follow-up',
        ]);
    }

    public function test_apply_body_only_macro_sends_reply(): void
    {
        $macro = Macro::factory()->create([
            'name' => 'Plain reply',
            'body' => 'Thanks for writing in.',
            'actions' => null,
        ]);

        $ticket = Ticket::factory()->create(['status' => 'open']);

        $this->post("/securecrm/tickets/{$ticket->id}/macro/{$macro->id}")
            ->assertRedirect();

        $this->assertDatabaseHas('ticket_messages', [
            'ticket_id' => $ticket->id,
            'type' => 'reply',
            'body' => 'Thanks for writing in.',
        ]);
    }

    public function test_apply_disabled_macro_returns_404(): void
    {
        $macro = Macro::factory()->disabled()->create();
        $ticket = Ticket::factory()->create();

        $this->post("/securecrm/tickets/{$ticket->id}/macro/{$macro->id}")
            ->assertNotFound();
    }

    public function test_apply_macro_requires_permission_for_each_action(): void
    {
        $macro = Macro::factory()->create([
            'actions' => [
                ['type' => 'change_status', 'value' => 'resolved'],
            ],
        ]);

        $ticket = Ticket::factory()->create();

        // support_agent lacks ticket.close → status-changing macro is forbidden.
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/macro/{$macro->id}")
            ->assertForbidden();

        $this->assertSame('new', $ticket->fresh()->status);
    }

    public function test_apply_macro_without_actor_permission_check_in_service(): void
    {
        $macro = Macro::factory()->create([
            'body' => '',
            'actions' => [
                ['type' => 'add_tag', 'value' => 'followup'],
            ],
        ]);

        $ticket = Ticket::factory()->create();

        // System context (no actor) applies fine.
        $applied = (new MacroService)->apply($macro, $ticket);

        $this->assertSame(['add_tag'], $applied);
        $this->assertDatabaseHas('ticket_tags', [
            'ticket_id' => $ticket->id,
            'name' => 'followup',
        ]);
    }

    public function test_add_tag_is_idempotent(): void
    {
        $macro = Macro::factory()->create([
            'actions' => [['type' => 'add_tag', 'value' => 'kyc']],
        ]);

        $ticket = Ticket::factory()->create();
        TicketTag::create(['ticket_id' => $ticket->id, 'name' => 'kyc']);

        (new MacroService)->apply($macro, $ticket);

        $this->assertSame(1, TicketTag::where('ticket_id', $ticket->id)->count());
    }

    public function test_action_summary_describes_macro(): void
    {
        $macro = Macro::factory()->create([
            'actions' => [
                ['type' => 'change_status', 'value' => 'open'],
                ['type' => 'add_tag', 'value' => 'kyc'],
            ],
        ]);

        $this->assertStringContainsString('Status → open', $macro->actionSummary());
        $this->assertStringContainsString('Tag kyc', $macro->actionSummary());
    }
}
