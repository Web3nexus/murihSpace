<?php

namespace Tests\Feature;

use App\Models\Ticket;
use App\Models\TicketCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class CustomerTicketApiTest extends TestCase
{
    use RefreshDatabase;

    private const EMAIL = 'customer@example.com';

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('internal.token', 'test-secret');
    }

    private function headers(string $email = self::EMAIL): array
    {
        return [
            'X-Internal-Token' => 'test-secret',
            'X-Customer-Email' => $email,
            'Accept' => 'application/json',
        ];
    }

    public function test_requires_internal_token(): void
    {
        $this->postJson('/api/customer/tickets', [], [
            'X-Customer-Email' => self::EMAIL,
        ])->assertStatus(403);
    }

    public function test_requires_valid_customer_email(): void
    {
        $this->getJson('/api/customer/tickets', [
            'X-Internal-Token' => 'test-secret',
            'X-Customer-Email' => 'not-an-email',
        ])->assertStatus(422);
    }

    public function test_categories_endpoint_returns_grouped_categories(): void
    {
        $parent = TicketCategory::factory()->create(['parent_id' => null, 'slug' => 'payments']);
        $child = TicketCategory::factory()->create(['parent_id' => $parent->id, 'slug' => 'payments.billing']);

        $response = $this->getJson('/api/customer/tickets/categories', $this->headers());

        $response->assertOk()
            ->assertJsonPath('success', true);

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertSame('payments', $data[0]['slug']);
        $this->assertSame('payments.billing', $data[0]['children'][0]['slug']);
    }

    public function test_customer_can_create_ticket(): void
    {
        $category = TicketCategory::factory()->create();

        $response = $this->postJson('/api/customer/tickets', [
            'subject' => 'Can not log in',
            'description' => 'I keep getting an error.',
            'category_id' => $category->id,
            'priority' => 'high',
        ], $this->headers());

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['ticket_number', 'status', 'messages']]);

        $ticket = Ticket::first();
        $this->assertNotNull($ticket);
        $this->assertSame(self::EMAIL, $ticket->customer_email);
        $this->assertSame('app', $ticket->channel);
        $this->assertSame('new', $ticket->status);
        $this->assertSame($category->id, $ticket->category_id);
    }

    public function test_customer_lists_only_own_tickets(): void
    {
        $mine = Ticket::factory()->create(['customer_email' => self::EMAIL]);
        Ticket::factory()->create(['customer_email' => 'other@example.com']);

        $response = $this->getJson('/api/customer/tickets', $this->headers());

        $response->assertOk()
            ->assertJsonPath('success', true);

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertSame($mine->ticket_number, $data[0]['ticket_number']);
    }

    public function test_customer_cannot_view_others_ticket(): void
    {
        $ticket = Ticket::factory()->create(['customer_email' => 'other@example.com']);

        $this->getJson("/api/customer/tickets/{$ticket->id}", $this->headers())
            ->assertStatus(404);
    }

    public function test_show_excludes_internal_notes(): void
    {
        $ticket = Ticket::factory()->create(['customer_email' => self::EMAIL]);
        $ticket->messages()->create(['type' => 'reply', 'body' => 'We are looking into this.']);
        $ticket->messages()->create(['type' => 'internal_note', 'body' => 'This customer is a VIP.']);

        $response = $this->getJson("/api/customer/tickets/{$ticket->id}", $this->headers());

        $response->assertOk();
        $messages = $response->json('data.messages');
        $this->assertCount(1, $messages);
        $this->assertSame('We are looking into this.', $messages[0]['body']);
    }

    public function test_customer_can_reply_to_open_ticket(): void
    {
        $ticket = Ticket::factory()->create(['customer_email' => self::EMAIL, 'status' => 'pending_customer']);

        $response = $this->postJson("/api/customer/tickets/{$ticket->id}/reply", [
            'body' => 'Thanks, here is more info.',
        ], $this->headers());

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.body', 'Thanks, here is more info.');

        $ticket->refresh();
        $this->assertSame('open', $ticket->status);
        $this->assertDatabaseHas('ticket_messages', [
            'ticket_id' => $ticket->id,
            'type' => 'customer_message',
        ]);
    }

    public function test_customer_cannot_reply_to_closed_ticket(): void
    {
        $ticket = Ticket::factory()->create(['customer_email' => self::EMAIL, 'status' => 'closed']);

        $this->postJson("/api/customer/tickets/{$ticket->id}/reply", [
            'body' => 'Hello again',
        ], $this->headers())->assertStatus(422);
    }

    public function test_customer_can_close_resolved_ticket(): void
    {
        $ticket = Ticket::factory()->create(['customer_email' => self::EMAIL, 'status' => 'resolved']);

        $response = $this->postJson("/api/customer/tickets/{$ticket->id}/status", [
            'status' => 'closed',
        ], $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.status', 'closed');

        $ticket->refresh();
        $this->assertNotNull($ticket->closed_at);
        $this->assertDatabaseHas('ticket_events', [
            'ticket_id' => $ticket->id,
            'event' => 'customer_closed',
        ]);
    }

    public function test_customer_can_reopen_ticket(): void
    {
        $ticket = Ticket::factory()->create(['customer_email' => self::EMAIL, 'status' => 'closed', 'closed_at' => now()]);

        $response = $this->postJson("/api/customer/tickets/{$ticket->id}/status", [
            'status' => 'reopened',
        ], $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.status', 'reopened');

        $ticket->refresh();
        $this->assertNull($ticket->closed_at);
    }

    public function test_customer_can_rate_resolved_ticket(): void
    {
        $ticket = Ticket::factory()->create(['customer_email' => self::EMAIL, 'status' => 'resolved']);

        $response = $this->postJson("/api/customer/tickets/{$ticket->id}/rate", [
            'rating' => 5,
            'comment' => 'Great support!',
        ], $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.rating', 5);

        $ticket->refresh();
        $this->assertSame(5, $ticket->rating);
        $this->assertSame('Great support!', $ticket->rating_comment);
        $this->assertNotNull($ticket->rated_at);
    }

    public function test_customer_cannot_rate_open_ticket_or_twice(): void
    {
        $open = Ticket::factory()->create(['customer_email' => self::EMAIL, 'status' => 'open']);
        $this->postJson("/api/customer/tickets/{$open->id}/rate", ['rating' => 4], $this->headers())
            ->assertStatus(422);

        $resolved = Ticket::factory()->create(['customer_email' => self::EMAIL, 'status' => 'resolved', 'rating' => 3]);
        $this->postJson("/api/customer/tickets/{$resolved->id}/rate", ['rating' => 4], $this->headers())
            ->assertStatus(422);
    }
}
