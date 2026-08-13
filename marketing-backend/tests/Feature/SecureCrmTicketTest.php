<?php

namespace Tests\Feature;

use App\Models\StaffUser;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecureCrmTicketTest extends TestCase
{
    use RefreshDatabase;

    public function test_tickets_index_lists_tickets_for_permitted_staff(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();
        $ticket = Ticket::factory()->create(['subject' => 'Cannot sign in']);

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/tickets')
            ->assertOk()
            ->assertSee('Cannot sign in')
            ->assertSee($ticket->ticket_number);
    }

    public function test_tickets_index_requires_ticket_view_permission(): void
    {
        $editor = StaffUser::factory()->role('help_editor')->create();

        $this->actingAs($editor, 'staff')
            ->get('/securecrm/tickets')
            ->assertForbidden();
    }

    public function test_staff_can_create_a_ticket(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();
        $category = TicketCategory::factory()->create();

        $response = $this->actingAs($agent, 'staff')
            ->post('/securecrm/tickets', [
                'subject' => 'Payment failed',
                'description' => 'My card was charged twice.',
                'category_id' => $category->id,
                'priority' => 'high',
                'assigned_agent_id' => $agent->id,
            ]);

        $response->assertRedirect();

        $ticket = Ticket::first();
        $this->assertNotNull($ticket);
        $this->assertSame('Payment failed', $ticket->subject);
        $this->assertSame('high', $ticket->priority);
        $this->assertSame('staff_created', $ticket->channel);
        $this->assertSame($agent->id, $ticket->created_by);
        $this->assertSame($agent->id, $ticket->assigned_agent_id);
        $this->assertSame('open', $ticket->status);
        $this->assertStringStartsWith('MS-', $ticket->ticket_number);
    }

    public function test_staff_cannot_create_ticket_without_permission(): void
    {
        $editor = StaffUser::factory()->role('help_editor')->create();

        $this->actingAs($editor, 'staff')
            ->post('/securecrm/tickets', [
                'subject' => 'Test',
                'description' => 'Body',
                'priority' => 'normal',
            ])
            ->assertForbidden();

        $this->assertDatabaseCount('tickets', 0);
    }

    public function test_ticket_show_renders_for_permitted_staff(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();
        $ticket = Ticket::factory()->forUser()->withCategory()->create(['description' => "Line one\nLine two"]);

        $this->actingAs($agent, 'staff')
            ->get("/securecrm/tickets/{$ticket->id}")
            ->assertOk()
            ->assertSee($ticket->ticket_number)
            ->assertSee($ticket->subject);
    }

    public function test_ticket_show_renders_visitor_context_panel(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();
        $ticket = Ticket::factory()->create([
            'description' => 'I could not find anything.',
            'context' => [
                'search_query' => 'how do I send a gift',
                'attempted_article' => 'send-gift',
                'current_page' => '/help',
                'device' => 'iPhone 15 / iOS 18',
            ],
        ]);

        $this->actingAs($agent, 'staff')
            ->get("/securecrm/tickets/{$ticket->id}")
            ->assertOk()
            ->assertSee('Visitor context')
            ->assertSee('how do I send a gift')
            ->assertSee('send-gift')
            ->assertSee('/help')
            ->assertSee('iPhone 15 / iOS 18');
    }

    public function test_ticket_number_is_sequential(): void
    {
        $a = Ticket::factory()->create();
        $b = Ticket::factory()->create();

        $this->assertNotSame($a->ticket_number, $b->ticket_number);
        $this->assertMatchesRegularExpression('/^MS-\d{4}-\d{6}$/', $a->ticket_number);
    }

    public function test_ticket_number_accepts_system_channel(): void
    {
        $ticket = Ticket::factory()->create(['channel' => 'system']);

        $this->assertSame('system', $ticket->channel);
        $this->assertTrue($ticket->isOpen());
    }

    public function test_filters_search_by_customer_email(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();
        $user = User::factory()->create(['email' => 'jane@example.com']);
        Ticket::factory()->forUser($user)->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/tickets?q=jane@example.com')
            ->assertOk()
            ->assertSee($user->email);
    }
}
