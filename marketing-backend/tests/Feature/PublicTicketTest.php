<?php

namespace Tests\Feature;

use App\Models\Ticket;
use App\Models\TicketCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicTicketTest extends TestCase
{
    use RefreshDatabase;

    public function test_help_center_form_creates_ticket(): void
    {
        $category = TicketCategory::factory()->create(['slug' => 'payments.billing']);

        $response = $this->postJson('/api/public/help/tickets', [
            'subject' => 'Double charge',
            'description' => 'I was charged twice for my membership.',
            'email' => 'customer@example.com',
            'category_slug' => 'payments.billing',
            'priority' => 'high',
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['ticket_number', 'status']]);

        $ticket = Ticket::first();
        $this->assertNotNull($ticket);
        $this->assertSame('Double charge', $ticket->subject);
        $this->assertSame('help_center_form', $ticket->channel);
        $this->assertSame('high', $ticket->priority);
        $this->assertSame('new', $ticket->status);
        $this->assertSame($category->id, $ticket->category_id);
        $this->assertStringStartsWith('MS-', $ticket->ticket_number);
    }

    public function test_help_center_form_defaults_priority(): void
    {
        $this->postJson('/api/public/help/tickets', [
            'subject' => 'Hello',
            'description' => 'World',
            'email' => 'customer@example.com',
        ])->assertCreated();

        $this->assertSame('normal', Ticket::first()->priority);
    }

    public function test_help_center_form_validates_required_fields(): void
    {
        $this->postJson('/api/public/help/tickets', [
            'email' => 'customer@example.com',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['subject', 'description']);
    }

    public function test_help_center_form_rejects_invalid_priority(): void
    {
        $this->postJson('/api/public/help/tickets', [
            'subject' => 'Hello',
            'description' => 'World',
            'email' => 'customer@example.com',
            'priority' => 'super-secret',
        ])->assertUnprocessable();

        $this->assertDatabaseCount('tickets', 0);
    }

    public function test_help_center_form_rejects_invalid_category_slug(): void
    {
        $this->postJson('/api/public/help/tickets', [
            'subject' => 'Hello',
            'description' => 'World',
            'email' => 'customer@example.com',
            'category_slug' => 'does-not-exist',
        ])->assertUnprocessable();

        $this->assertDatabaseCount('tickets', 0);
    }

    public function test_help_center_form_stores_visitor_context(): void
    {
        $this->postJson('/api/public/help/tickets', [
            'subject' => 'No article about gifting',
            'description' => 'I searched and found nothing helpful.',
            'email' => 'customer@example.com',
            'context' => [
                'search_query' => 'how do I send a gift',
                'attempted_article' => 'send-gift',
                'current_page' => '/help',
                'user_id' => 42,
                'device' => 'iPhone 15 / iOS 18',
            ],
        ], [
            'User-Agent' => 'Mozilla/5.0 (TestBrowser)',
        ])->assertCreated();

        $ticket = Ticket::first();
        $this->assertNotNull($ticket);
        $this->assertSame('how do I send a gift', $ticket->context['search_query']);
        $this->assertSame('send-gift', $ticket->context['attempted_article']);
        $this->assertSame('/help', $ticket->context['current_page']);
        $this->assertSame(42, $ticket->context['user_id']);
        $this->assertSame('iPhone 15 / iOS 18', $ticket->context['device']);
        $this->assertStringContainsString('TestBrowser', $ticket->context['user_agent']);
        $this->assertNotNull($ticket->context['ip_address']);
    }

    public function test_help_center_form_without_context_only_captures_enrichment(): void
    {
        $this->postJson('/api/public/help/tickets', [
            'subject' => 'Hello',
            'description' => 'World',
            'email' => 'customer@example.com',
        ])->assertCreated();

        $context = Ticket::first()->context;
        $this->assertNotNull($context);
        $this->assertArrayNotHasKey('search_query', $context);
        $this->assertArrayNotHasKey('current_page', $context);
        $this->assertArrayHasKey('user_agent', $context);
        $this->assertArrayHasKey('ip_address', $context);
    }

    public function test_help_center_form_rejects_invalid_context(): void
    {
        $this->postJson('/api/public/help/tickets', [
            'subject' => 'Hello',
            'description' => 'World',
            'email' => 'customer@example.com',
            'context' => [
                'search_query' => str_repeat('a', 501),
                'user_id' => 'not-an-int',
            ],
        ])->assertUnprocessable();

        $this->assertDatabaseCount('tickets', 0);
    }
}
