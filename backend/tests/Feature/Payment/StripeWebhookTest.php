<?php

namespace Tests\Feature\Payment;

use App\Jobs\ProcessPaymentWebhookJob;
use App\Models\PaymentWebhookEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Stripe cannot use the shared verif-hash pipeline, so it gets a dedicated
 * handler. These tests cover what was previously missing entirely: the route
 * did not exist and there was no controller method.
 */
class StripeWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'whsec_test_secret';

    protected function setUp(): void
    {
        parent::setUp();
        config(['stripe.webhook_secret' => self::SECRET]);
    }

    /**
     * Build a genuine Stripe-Signature header:
     *   t=<unix ts>,v1=HMAC_SHA256(secret, "<ts>.<raw body>")
     */
    private function postSigned(array $body, ?string $overrideSignature = null)
    {
        // Sign exactly the bytes postJson() will put on the wire.
        $payload = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $ts = time();
        $signature = $overrideSignature ?? 't='.$ts.',v1='.hash_hmac('sha256', $ts.'.'.$payload, self::SECRET);

        return $this->withHeaders(['Stripe-Signature' => $signature])
            ->postJson('/api/v1/webhooks/stripe', $body);
    }

    private function succeededEvent(string $eventId = 'evt_1'): array
    {
        return [
            'id' => $eventId,
            'type' => 'payment_intent.succeeded',
            'data' => ['object' => ['id' => 'pi_test_123', 'amount' => 500000]],
        ];
    }

    public function test_stripe_webhook_route_is_registered(): void
    {
        $route = collect(app('router')->getRoutes()->getRoutes())
            ->first(fn ($r) => $r->uri() === 'api/v1/webhooks/stripe');

        $this->assertNotNull($route, 'POST /api/v1/webhooks/stripe must be registered for Stripe webhooks.');
        $this->assertContains('POST', $route->methods());
    }

    public function test_valid_signature_is_ingested_and_queued(): void
    {
        Queue::fake();

        $this->postSigned($this->succeededEvent())
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'received');

        $this->assertDatabaseHas('payment_webhook_events', [
            'provider' => 'stripe',
            'provider_event_id' => 'evt_1',
            'event_type' => 'payment_intent.succeeded',
            'signature_verified' => true,
        ]);

        Queue::assertPushed(ProcessPaymentWebhookJob::class, 1);
    }

    public function test_duplicate_delivery_is_idempotent(): void
    {
        // Stripe retries aggressively; a replay must not queue a second
        // fulfilment.
        Queue::fake();

        $this->postSigned($this->succeededEvent())->assertStatus(200);
        $this->postSigned($this->succeededEvent())
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'acknowledged');

        $this->assertSame(1, PaymentWebhookEvent::where('provider', 'stripe')->count());
        Queue::assertPushed(ProcessPaymentWebhookJob::class, 1);
    }

    public function test_queue_failure_does_not_leave_a_record_that_would_swallow_the_retry(): void
    {
        // If dispatch throws, the record must be rolled back: otherwise Stripe's
        // retry hits the dedupe guard, gets a 200, and the payment is never
        // processed.
        // Swap in a queue manager whose broker connection is unavailable, so
        // dispatching the job throws.
        $queue = \Mockery::mock(\Illuminate\Queue\QueueManager::class);
        $queue->shouldReceive('connection')->andThrow(new \RuntimeException('broker down'));
        $this->app->instance('queue', $queue);

        $this->postSigned($this->succeededEvent())->assertStatus(500);

        $this->assertSame(
            0,
            PaymentWebhookEvent::where('provider', 'stripe')->count(),
            'Orphaned record must be removed so a retry can re-ingest and re-queue it.'
        );
    }

    public function test_missing_signature_is_rejected(): void
    {
        Queue::fake();

        $this->postJson('/api/v1/webhooks/stripe', $this->succeededEvent())
            ->assertStatus(401);

        Queue::assertNothingPushed();
    }

    public function test_tampered_signature_is_rejected(): void
    {
        Queue::fake();

        $this->postSigned($this->succeededEvent(), 't=1,v1=deadbeef')
            ->assertStatus(401);

        $this->assertDatabaseCount('payment_webhook_events', 0);
        Queue::assertNothingPushed();
    }

    public function test_signature_made_with_the_wrong_secret_is_rejected(): void
    {
        Queue::fake();

        $payload = json_encode($this->succeededEvent());
        $forged = 't='.time().',v1='.hash_hmac('sha256', time().'.'.$payload, 'whsec_attacker');

        $this->postSigned($this->succeededEvent(), $forged)->assertStatus(401);
        Queue::assertNothingPushed();
    }

    public function test_unconfigured_webhook_secret_rejects_rather_than_accepts(): void
    {
        Queue::fake();
        config(['stripe.webhook_secret' => null]);

        $body = $this->succeededEvent();
        $ts = time();
        $signature = 't='.$ts.',v1='.hash_hmac('sha256', $ts.'.'.json_encode($body), self::SECRET);

        $this->withHeaders(['Stripe-Signature' => $signature])
            ->postJson('/api/v1/webhooks/stripe', $body)
            ->assertStatus(401);

        Queue::assertNothingPushed();
    }
}
