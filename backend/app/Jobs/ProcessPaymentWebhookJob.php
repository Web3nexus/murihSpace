<?php

namespace App\Jobs;

use App\Models\Payment;
use App\Models\PaymentWebhookEvent;
use App\Services\Payment\Contracts\CollectionProviderInterface;
use App\Services\Payment\DTO\PaymentVerificationResult;
use App\Services\Payment\PaymentService;
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
            $provider = $router->getProvider($event->provider);
            $payload = $event->payload ?? [];

            // Extract resource reference from provider payload
            $resourceRef = null;
            if ($event->provider === 'paystack') {
                $resourceRef = $payload['data']['reference'] ?? null;
            } elseif ($event->provider === 'airwallex') {
                $data = $payload['data']['object'] ?? [];
                $resourceRef = $data['id'] ?? $data['merchant_order_id'] ?? null;
            } elseif ($event->provider === 'flutterwave') {
                $resourceRef = $payload['data']['tx_ref'] ?? null;
            }

            if ($resourceRef) {
                // Find matching internal payment record
                $payment = Payment::where('public_reference', $resourceRef)
                    ->orWhere('provider_reference', $resourceRef)
                    ->orWhere('internal_reference', $resourceRef)
                    ->first();

                if ($payment) {
                    // Server-side verification (Mandatory for Flutterwave & recommended for all)
                    if ($provider instanceof CollectionProviderInterface) {
                        $verificationId = $payload['data']['id'] ?? $resourceRef;
                        $verificationResult = $provider->verifyPayment((string) $verificationId);
                    } else {
                        $verificationResult = new PaymentVerificationResult(
                            isSuccessful: true,
                            status: \App\Enums\PaymentStatus::Successful,
                            providerReference: $resourceRef
                        );
                    }

                    $paymentService->finalizePayment($payment, $verificationResult);
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

