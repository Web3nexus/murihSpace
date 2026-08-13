<?php

namespace Tests\Feature;

use App\Models\StaffUser;
use App\Models\SupportEvent;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class SupportEventWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'test-internal-token';

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        config(['internal.token' => self::TOKEN]);
        RateLimiter::clear('internal-api:events:'.sha1(self::TOKEN));
    }

    private function headers(): array
    {
        return [
            'X-Internal-Token' => self::TOKEN,
            'X-Timestamp' => (string) now()->getTimestamp(),
            'X-Nonce' => (string) now()->format('Uu').bin2hex(random_bytes(8)),
            'Accept' => 'application/json',
        ];
    }

    public function test_ingest_stores_event(): void
    {
        $response = $this->postJson('/api/internal/events', [
            'event_id' => 'evt-1',
            'event_key' => 'user.created',
            'occurred_at' => now()->toISOString(),
            'payload' => ['user' => ['id' => 5, 'name' => 'Ada', 'email' => 'ada@example.com']],
        ], $this->headers());

        $response->assertStatus(201)
            ->assertJsonPath('data.event_key', 'user.created')
            ->assertJsonPath('data.status', 'ignored');

        $this->assertDatabaseHas('support_events', [
            'event_id' => 'evt-1',
            'event_key' => 'user.created',
            'status' => 'ignored',
        ]);
    }

    public function test_ingest_is_idempotent(): void
    {
        $this->postJson('/api/internal/events', [
            'event_id' => 'evt-dupe',
            'event_key' => 'user.created',
        ], $this->headers())->assertStatus(201);

        $this->postJson('/api/internal/events', [
            'event_id' => 'evt-dupe',
            'event_key' => 'user.created',
        ], $this->headers())
            ->assertStatus(200)
            ->assertJsonPath('data.duplicate', true);

        $this->assertSame(1, SupportEvent::where('event_id', 'evt-dupe')->count());
    }

    public function test_rejected_token_is_forbidden(): void
    {
        $this->postJson('/api/internal/events', [
            'event_id' => 'evt-x',
            'event_key' => 'user.created',
        ], array_merge($this->headers(), ['X-Internal-Token' => 'wrong']))
            ->assertStatus(403);

        $this->assertSame(0, SupportEvent::count());
    }

    public function test_reused_nonce_is_rejected(): void
    {
        $nonce = bin2hex(random_bytes(16));
        $headers = array_merge($this->headers(), ['X-Nonce' => $nonce]);

        $this->postJson('/api/internal/events', ['event_id' => 'a', 'event_key' => 'x'], $headers)->assertStatus(201);
        $this->postJson('/api/internal/events', ['event_id' => 'b', 'event_key' => 'x'], $headers)->assertStatus(400);

        $this->assertSame(1, SupportEvent::count());
    }

    public function test_stale_timestamp_is_rejected(): void
    {
        $headers = array_merge($this->headers(), ['X-Timestamp' => (string) (now()->getTimestamp() - 3600)]);

        $this->postJson('/api/internal/events', ['event_id' => 'c', 'event_key' => 'x'], $headers)->assertStatus(400);
    }

    public function test_critical_event_raises_ticket(): void
    {
        $staff = StaffUser::factory()->admin()->create();

        $response = $this->postJson('/api/internal/events', [
            'event_id' => 'evt-critical',
            'event_key' => 'kyc.rejected',
            'customer_email' => 'mom@example.com',
            'actor_type' => 'kyc',
            'actor_reference' => '77',
            'payload' => ['reason' => 'Document illegible'],
        ], $this->headers());

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'ticket_created')
            ->assertJsonStructure(['data' => ['ticket_number']]);

        $event = SupportEvent::where('event_id', 'evt-critical')->firstOrFail();
        $this->assertSame('ticket_created', $event->status);

        $ticket = Ticket::where('ticket_number', $event->ticket_number)->firstOrFail();
        $this->assertSame('mom@example.com', $ticket->customer_email);
        $this->assertStringContainsString('Identity verification rejected', $ticket->subject);
        $this->assertStringContainsString('Document illegible', $ticket->description);
    }

    public function test_non_critical_event_does_not_raise_ticket(): void
    {
        $this->postJson('/api/internal/events', [
            'event_id' => 'evt-plain',
            'event_key' => 'user.created',
            'customer_email' => 'ada@example.com',
        ], $this->headers())->assertStatus(201);

        $this->assertSame(0, Ticket::count());
    }

    public function test_event_can_be_looked_up(): void
    {
        $this->postJson('/api/internal/events', [
            'event_id' => 'evt-lookup',
            'event_key' => 'user.created',
        ], $this->headers())->assertStatus(201);

        $this->getJson('/api/internal/events/evt-lookup', $this->headers())
            ->assertOk()
            ->assertJsonPath('data.event_id', 'evt-lookup');
    }
}
