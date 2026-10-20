<?php

namespace App\Jobs;

use App\Models\Payment;
use App\Models\PaymentWebhookEvent;
use App\Services\Payment\Contracts\CollectionProviderInterface;
use App\Services\Payment\DTO\PaymentVerificationResult;
use App\Services\Payment\Exceptions\RoutingException;
use App\Services\Payment\PaymentService;
use App\Services\Payment\PayoutSettlementService;
use App\Services\Payment\ProviderResultResolver;
use App\Services\Payment\RefundService;
use App\Services\Payment\Router\ProviderRouter;
use Exception;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessPaymentWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 10;

    public function __construct(
        public readonly int $webhookEventId
    ) {
        $this->onQueue(config('payments.webhooks.queue_name', 'default'));
    }

    public function handle(PaymentService $paymentService, ProviderRouter $router): void
    {
        $event = PaymentWebhookEvent::find($this->webhookEventId);

        if (!$event || $event->processing_status === 'completed') {
            return;
        }

        $event->update(['processing_status' => 'processing', 'attempts' => $event->attempts + 1]);

        try {
            // Stripe is handled by the legacy order flow and is not registered
            // in ProviderRouter, so a lookup failure is expected, not fatal.
            $provider = null;
            try {
                $provider = $router->getProvider($event->provider);
            } catch (RoutingException) {
                $provider = null;
            }
            $payload = $event->payload ?? [];

            // Transfer and refund results settle money. They are handled before any payment lookup, and the
            // settlement services are idempotent, so a retried job cannot move money twice.
            $payoutEvent = ProviderResultResolver::payout($event->provider, (string) $event->event_type, $payload);
            if ($payoutEvent !== null) {
                app(PayoutSettlementService::class)->applyWebhookOutcome($payoutEvent);
                $event->update(['processing_status' => 'completed', 'processed_at' => now()]);

                return;
            }

            $refundEvent = ProviderResultResolver::refund($event->provider, (string) $event->event_type, $payload);
            if ($refundEvent !== null) {
                $refundResult = app(RefundService::class)->applyWebhookOutcome($event->provider, $refundEvent);

                if ($refundResult === 'unmatched') {
                    // Not guessed at: no refund row could be identified from the payload. Kept for admin review.
                    $event->update([
                        'processing_status' => 'unmatched',
                        'error_message' => 'Refund result matched no single refund. Review it and settle it manually.',
                        'processed_at' => now(),
                    ]);

                    return;
                }

                $event->update(['processing_status' => 'completed', 'processed_at' => now()]);

                return;
            }

            // Paystack refund.processing and refund.pending are recorded only. They are not results and must not
            // release a hold or debit a balance. The refund stays in its current state until a final event arrives.
            if ($event->provider === 'paystack' && str_starts_with((string) $event->event_type, 'refund.')) {
                $event->update([
                    'processing_status' => 'ignored',
                    'error_message' => 'Non-final refund status. Recorded, no settlement.',
                    'processed_at' => now(),
                ]);

                return;
            }

            // Extract resource reference from provider payload
            $resourceRef = null;
            if ($event->provider === 'paystack') {
                $resourceRef = $payload['data']['reference'] ?? null;
            } elseif ($event->provider === 'airwallex') {
                $data = $payload['data']['object'] ?? [];
                $resourceRef = $data['id'] ?? $data['merchant_order_id'] ?? null;
            } elseif ($event->provider === 'flutterwave') {
                $resourceRef = $payload['data']['tx_ref'] ?? null;
            } elseif ($event->provider === 'paddle') {
                // Prefer the internal reference we attached at checkout, then the transaction id.
                $resourceRef = $payload['data']['custom_data']['internal_reference']
                    ?? $payload['data']['custom_data']['public_reference']
                    ?? $payload['data']['id']
                    ?? null;
            } elseif ($event->provider === 'stripe') {
                $resourceRef = $payload['data']['object']['id'] ?? null;
            }

            if ($resourceRef) {
                // Find matching internal payment record. The provider column must
                // be part of the match, and the reference alternatives grouped,
                // otherwise a reference reused by another gateway could settle
                // the wrong payment (SQL binds AND tighter than OR).
                // provider_transaction_id matters for providers whose webhook
                // carries the gateway's own id (Stripe intent id, Paystack
                // numeric id) rather than the reference attached at checkout.
                $payment = Payment::where('provider', $event->provider)
                    ->where(function ($query) use ($resourceRef) {
                        $query->where('public_reference', $resourceRef)
                            ->orWhere('provider_reference', $resourceRef)
                            ->orWhere('provider_transaction_id', $resourceRef)
                            ->orWhere('internal_reference', $resourceRef);
                    })
                    ->first();

                if ($payment) {
                    // Server-side verification (Mandatory for Flutterwave & recommended for all)
                    if ($provider instanceof CollectionProviderInterface) {
                        $verificationId = $payload['data']['id'] ?? $resourceRef;
                        $verificationResult = $provider->verifyPayment((string) $verificationId);
                    } elseif ($event->provider === 'stripe') {
                        // Only terminal PaymentIntent events may move a payment
                        // to a final state. Stripe also sends non-terminal ones
                        // (payment_intent.created, .processing, charge.*, ...) and
                        // treating those as a failure would wrongly fail a
                        // payment that is still in flight.
                        $verificationResult = match ($event->event_type) {
                            'payment_intent.succeeded' => new PaymentVerificationResult(
                                isSuccessful: true,
                                status: \App\Enums\PaymentStatus::Successful,
                                providerReference: $resourceRef
                            ),
                            'payment_intent.payment_failed' => new PaymentVerificationResult(
                                isSuccessful: false,
                                status: \App\Enums\PaymentStatus::Failed,
                                providerReference: $resourceRef
                            ),
                            'payment_intent.canceled' => new PaymentVerificationResult(
                                isSuccessful: false,
                                status: \App\Enums\PaymentStatus::Cancelled,
                                providerReference: $resourceRef
                            ),
                            default => null,
                        };
                    } else {
                        $verificationResult = new PaymentVerificationResult(
                            isSuccessful: true,
                            status: \App\Enums\PaymentStatus::Successful,
                            providerReference: $resourceRef
                        );
                    }

                    if ($verificationResult !== null) {
                        $paymentService->finalizePayment($payment, $verificationResult);
                    }
                }
            }

            $event->update([
                'processing_status' => 'completed',
                'processed_at' => now(),
            ]);
        } catch (Exception $e) {
            Log::error("Failed to process webhook event #{$event->id}: {$e->getMessage()}", [
                'provider' => $event->provider,
                'event_type' => $event->event_type,
            ]);

            $event->update([
                'processing_status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}

