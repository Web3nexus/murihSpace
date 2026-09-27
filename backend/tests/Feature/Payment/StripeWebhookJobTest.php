<?php

namespace Tests\Feature\Payment;

use App\Enums\PaymentStatus;
use App\Jobs\ProcessPaymentWebhookJob;
use App\Models\Payment;
use App\Models\PaymentWebhookEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

/**
 * Stripe emits many non-terminal events. Only terminal PaymentIntent events may
 * move a payment to a final state — otherwise an in-flight payment
 * (payment_intent.created / .processing) would be wrongly marked failed.
 */
class StripeWebhookJobTest extends TestCase
{
    use RefreshDatabase;

    private function payment(): Payment
    {
        return Payment::create([
            'public_reference' => 'PAY-STRIPE-'.uniqid(),
            'internal_reference' => 'uuid-stripe-'.uniqid(),
            'provider' => 'stripe',
            'transaction_type' => 'wallet_topup',
            'payment_method' => 'card',
            'amount' => 500000,
            'currency' => 'NGN',
            'fees' => 0,
            'net_amount' => 500000,
            'status' => PaymentStatus::Pending,
            'idempotency_key' => 'stripe-job-'.uniqid(),
        ]);
    }

    /**
     * @return array{0: Payment, 1: PaymentWebhookEvent}
     */
    private function event(Payment $payment, string $eventType): array
    {
        $event = PaymentWebhookEvent::create([
            'provider' => 'stripe',
            'provider_event_id' => 'evt_'.uniqid(),
            'event_type' => $eventType,
            'signature_verified' => true,
            'payload_hash' => hash('sha256', $eventType),
            'payload' => [
                'id' => 'evt_x',
                'type' => $eventType,
                'data' => ['object' => ['id' => 'pi_intent_1', 'amount' => 500000]],
            ],
            'processing_status' => 'received',
        ]);

        // The job looks the payment up by its provider_transaction_id, which is
        // what the intent id is recorded as.
        $payment->update(['provider_transaction_id' => 'pi_intent_1']);
        $payment->refresh();

        return [$payment, $event];
    }

    private ?Payment $finalizedPayment = null;

    /**
     * Run the job with a stubbed PaymentService and return the verification
     * result it was handed, or null when finalizePayment was never called.
     */
    private function runJob(PaymentWebhookEvent $event): ?\App\Services\Payment\DTO\PaymentVerificationResult
    {
        $captured = null;
        $this->finalizedPayment = null;

        $paymentService = Mockery::mock(\App\Services\Payment\PaymentService::class);
        $paymentService->shouldReceive('finalizePayment')
            ->andReturnUsing(function ($payment, $verification) use (&$captured) {
                $captured = $verification;
                $this->finalizedPayment = $payment;

                return true;
            });

        $job = new ProcessPaymentWebhookJob($event->id);
        $job->handle(
            $paymentService,
            Mockery::mock(\App\Services\Payment\Router\ProviderRouter::class)->shouldIgnoreMissing()
        );

        return $captured;
    }

    public function test_succeeded_event_finalizes_the_payment(): void
    {
        [$payment, $event] = $this->event($this->payment(), 'payment_intent.succeeded');

        $result = $this->runJob($event);

        $this->assertNotNull($result, 'A succeeded event must finalize the payment.');
        $this->assertTrue($result->isSuccessful);
        $this->assertSame(PaymentStatus::Successful, $result->status);
    }

    public function test_payment_failed_event_marks_the_payment_failed(): void
    {
        [$payment, $event] = $this->event($this->payment(), 'payment_intent.payment_failed');

        $result = $this->runJob($event);

        $this->assertNotNull($result);
        $this->assertFalse($result->isSuccessful);
        $this->assertSame(PaymentStatus::Failed, $result->status);
    }

    public function test_canceled_event_marks_the_payment_cancelled(): void
    {
        [$payment, $event] = $this->event($this->payment(), 'payment_intent.canceled');

        $result = $this->runJob($event);

        $this->assertNotNull($result);
        $this->assertFalse($result->isSuccessful);
        $this->assertSame(PaymentStatus::Cancelled, $result->status);
    }

    public function test_non_terminal_event_leaves_the_payment_pending(): void
    {
        // The regression: treating every non-succeeded event as a failure would
        // fail a payment that is still in flight.
        [, $event] = $this->event($this->payment(), 'payment_intent.created');

        $this->assertNull(
            $this->runJob($event),
            'A non-terminal Stripe event must not finalize the payment.',
        );
    }

    public function test_unrelated_charge_event_leaves_the_payment_pending(): void
    {
        [, $event] = $this->event($this->payment(), 'charge.succeeded');

        $this->assertNull($this->runJob($event));
    }

    public function test_job_completes_without_throwing_for_an_unregistered_provider(): void
    {
        // Stripe is not registered in ProviderRouter, so getProvider() raises
        // RoutingException. The job must swallow it and still finish.
        [, $event] = $this->event($this->payment(), 'payment_intent.succeeded');

        $router = Mockery::mock(\App\Services\Payment\Router\ProviderRouter::class);
        $router->shouldReceive('getProvider')
            ->andThrow(new \App\Services\Payment\Exceptions\RoutingException("Payment provider 'stripe' is not registered."));

        $job = new ProcessPaymentWebhookJob($event->id);
        $job->handle(
            Mockery::mock(\App\Services\Payment\PaymentService::class)->shouldIgnoreMissing(),
            $router
        );

        $this->assertSame('completed', $event->refresh()->processing_status);
    }

    public function test_payment_lookup_is_scoped_to_the_event_provider(): void
    {
        // An earlier, unscoped lookup could settle another gateway's payment when
        // reference values collide.
        $other = $this->payment();
        $other->update([
            'provider' => 'paystack',
            'provider_reference' => 'pi_intent_1',
        ]);

        [$mine, $event] = $this->event($this->payment(), 'payment_intent.succeeded');

        $this->runJob($event);

        $this->assertNotNull($this->finalizedPayment);
        $this->assertSame(
            $mine->id,
            $this->finalizedPayment->id,
            'A stripe event must settle the stripe payment, not a paystack one with a colliding reference.',
        );
    }
}
