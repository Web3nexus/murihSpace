<?php

namespace Tests\Feature;

use App\Models\Macro;
use App\Models\StaffUser;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecureCrmConversationTest extends TestCase
{
    use RefreshDatabase;

    public function test_agent_can_reply_to_ticket(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();
        $ticket = Ticket::factory()->create();

        $this->actingAs($agent, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/reply", ['body' => 'Thanks for the details, we are on it.'])
            ->assertRedirect();

        $message = TicketMessage::first();
        $this->assertNotNull($message);
        $this->assertSame('reply', $message->type);
        $this->assertSame($agent->id, $message->staff_user_id);
        $this->assertNull($message->user_id);
    }

    public function test_first_reply_stamps_first_response_at_and_opens_ticket(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();
        $ticket = Ticket::factory()->create(['status' => 'new']);

        $this->actingAs($agent, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/reply", ['body' => 'First reply.'])
            ->assertRedirect();

        $ticket->refresh();
        $this->assertNotNull($ticket->first_response_at);
        $this->assertSame('open', $ticket->status);
    }

    public function test_agent_can_add_internal_note(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();
        $ticket = Ticket::factory()->create();

        $this->actingAs($agent, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/note", ['body' => 'Waiting on legal approval.'])
            ->assertRedirect();

        $message = TicketMessage::first();
        $this->assertNotNull($message);
        $this->assertSame('internal_note', $message->type);
        $this->assertTrue($message->isInternal());
        $this->assertDatabaseHas('ticket_events', [
            'ticket_id' => $ticket->id,
            'event' => 'note_added',
            'staff_user_id' => $agent->id,
        ]);
    }

    public function test_agent_without_note_permission_cannot_add_note(): void
    {
        $editor = StaffUser::factory()->role('help_editor')->create();
        $ticket = Ticket::factory()->create();

        $this->actingAs($editor, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/note", ['body' => 'Sneaky note.'])
            ->assertForbidden();

        $this->assertDatabaseCount('ticket_messages', 0);
    }

    public function test_status_change_records_event_and_timestamps(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        $ticket = Ticket::factory()->create(['status' => 'open']);

        $this->actingAs($manager, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/status", ['status' => 'resolved'])
            ->assertRedirect();

        $ticket->refresh();
        $this->assertSame('resolved', $ticket->status);
        $this->assertNotNull($ticket->resolved_at);

        $this->assertDatabaseHas('ticket_events', [
            'ticket_id' => $ticket->id,
            'event' => 'status_changed',
            'old_value' => 'open',
            'new_value' => 'resolved',
            'staff_user_id' => $manager->id,
        ]);
    }

    public function test_escalate_records_escalation_event(): void
    {
        $senior = StaffUser::factory()->role('senior_agent')->create();
        $ticket = Ticket::factory()->create(['status' => 'open']);

        $this->actingAs($senior, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/escalate")
            ->assertRedirect();

        $ticket->refresh();
        $this->assertSame('escalated', $ticket->status);
        $this->assertDatabaseHas('ticket_events', [
            'ticket_id' => $ticket->id,
            'event' => 'escalated',
            'staff_user_id' => $senior->id,
        ]);
    }

    public function test_assign_records_assignment_event_and_opens_new_ticket(): void
    {
        $senior = StaffUser::factory()->role('senior_agent')->create();
        $target = StaffUser::factory()->role('support_agent')->create();
        $ticket = Ticket::factory()->create(['status' => 'new']);

        $this->actingAs($senior, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/assign", ['assigned_agent_id' => $target->id])
            ->assertRedirect();

        $ticket->refresh();
        $this->assertSame($target->id, $ticket->assigned_agent_id);
        $this->assertSame('open', $ticket->status);

        $this->assertDatabaseHas('ticket_events', [
            'ticket_id' => $ticket->id,
            'event' => 'assigned',
            'new_value' => (string) $target->id,
        ]);
    }

    public function test_conversation_thread_renders_on_ticket_page(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();
        $user = User::factory()->create(['name' => 'Jane Customer']);
        $ticket = Ticket::factory()->forUser($user)->create();
        TicketMessage::factory()->customerMessage()->forTicket($ticket)->create(['body' => 'Please help me log in.']);
        TicketMessage::factory()->internalNote()->forTicket($ticket)->create(['body' => 'Check KYC status.']);

        $response = $this->actingAs($agent, 'staff')
            ->get("/securecrm/tickets/{$ticket->id}")
            ->assertOk();

        $response->assertSee('Please help me log in.')
            ->assertSee('Jane Customer')
            ->assertSee('Internal note')
            ->assertSee('Check KYC status.')
            ->assertSee('Reply to customer');
    }

    public function test_macros_section_lists_and_creates(): void
    {
        $manager = StaffUser::factory()->role('support_manager')->create();
        Macro::factory()->create(['name' => 'Existing macro']);

        $this->actingAs($manager, 'staff')
            ->get('/securecrm/macros')
            ->assertOk()
            ->assertSee('Existing macro');

        $this->actingAs($manager, 'staff')
            ->post('/securecrm/macros', [
                'name' => 'New macro',
                'category' => 'Payments',
                'body' => 'Thanks {name}!',
            ])
            ->assertRedirect()
            ->assertSessionHas('status');

        $this->assertDatabaseHas('macros', ['name' => 'New macro', 'category' => 'Payments']);
    }

    public function test_macros_section_requires_macro_manage_permission(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/macros')
            ->assertForbidden();
    }
}
