<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessPaymentWebhookJob;
use App\Models\PaymentWebhookEvent;
use App\Services\Payment\Contracts\ProviderWebhookInterface;
use App\Services\Payment\Router\ProviderRouter;
use App\Services\Payment\StripePaymentProvider;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PaymentWebhookController extends Controller
{
    public function __construct(
        protected ProviderRouter $router
    ) {}

    /**
     * Dedicated webhook handler for Airwallex.
     */
    public function airwallex(Request $request): JsonResponse
    {
        return $this->handleWebhook($request, 'airwallex');
    }

    /**
     * Dedicated webhook handler for Paystack.
     */
    public function paystack(Request $request): JsonResponse
    {
        return $this->handleWebhook($request, 'paystack');
    }

    /**
     * Dedicated webhook handler for Flutterwave.
     */
    public function flutterwave(Request $request): JsonResponse
    {
        return $this->handleWebhook($request, 'flutterwave');
    }

    /**
     * Dedicated webhook handler for Paddle.
     */
    public function paddle(Request $request): JsonResponse
    {
        return $this->handleWebhook($request, 'paddle');
    }

    /**
     * Dedicated webhook handler for Stripe.
     *
     * Stripe does not use the shared `ProviderWebhookInterface` scheme (it has no
     * `verif-hash` equivalent), so it cannot go through handleWebhook(). Signature
     * verification is delegated to the official stripe-php library, which also
     * enforces the timestamp tolerance, and the verified event is then ingested
     * into the same dedupe/queue pipeline as every other provider.
     */
    public function stripe(Request $request): JsonResponse
    {
        try {
            $verified = (new StripePaymentProvider)->verifyWebhook($request);

            if ($verified === null) {
                Log::warning('Unauthorized webhook attempt on stripe', [
                    'ip' => $request->ip(),
                ]);

                return response()->json(['error' => 'Invalid signature'], 401);
            }

            return $this->ingestVerifiedEvent(
                'stripe',
                $verified['event_id'],
                $verified['event_type'],
                $request->json()->all(),
                hash('sha256', $request->getContent()),
            );
        } catch (Exception $e) {
            Log::error("Webhook error for stripe: {$e->getMessage()}");

            return response()->json(['error' => 'Webhook processing failed'], 500);
        }
    }

    /**
     * Unified secure webhook processing pipeline.
     */
    protected function handleWebhook(Request $request, string $providerCode): JsonResponse
    {
        try {
            $provider = $this->router->getProvider($providerCode);

            if (!($provider instanceof ProviderWebhookInterface)) {
                return response()->json(['error' => 'Provider does not support webhooks'], 400);
            }

            // 1. Validate Cryptographic Signature
            if (!$provider->verifyWebhookSignature($request)) {
                Log::warning("Unauthorized webhook attempt on {$providerCode}", [
                    'ip' => $request->ip(),
                    'headers' => $request->headers->all(),
                ]);
                return response()->json(['error' => 'Invalid signature'], 401);
            }

            // 2. Parse Event & Payload Hash
            $parsedEvent = $provider->parseWebhookEvent($request);
            $rawContent = $request->getContent();
            $payloadHash = hash('sha256', $rawContent);

            // 3-6. Deduplicate, persist and queue
            return $this->ingestVerifiedEvent(
                $providerCode,
                $parsedEvent->eventId,
                $parsedEvent->eventType,
                $parsedEvent->payload,
                $payloadHash,
            );
        } catch (Exception $e) {
            Log::error("Webhook error for {$providerCode}: {$e->getMessage()}");
            return response()->json(['error' => 'Webhook processing failed'], 500);
        }
    }

    /**
     * Deduplicate, persist and queue an already-signature-verified event.
     *
     * Shared by the generic pipeline and the dedicated Stripe path so the two
     * cannot drift apart.
     *
     * "Seen" therefore has to mean "handled". Every provider retries
     * aggressively, so leaving the record behind when the queue dispatch failed
     * meant the provider's retry matched the dedupe check, answered 200, and
     * dropped the payment with no error anywhere. Rolling the record back on
     * dispatch failure makes "seen" mean "the job is on the queue", which is
     * what the dedupe check actually has to guarantee.
     */
    protected function ingestVerifiedEvent(
        string $providerCode,
        string $eventId,
        string $eventType,
        array $payload,
        ?string $payloadHash = null,
    ): JsonResponse {
        $existing = PaymentWebhookEvent::where('provider', $providerCode)
            ->where('provider_event_id', $eventId)
            ->first();

        if ($existing) {
            return response()->json([
                'status' => 'acknowledged',
                'message' => 'Event already processed or queued (idempotent duplicate)',
            ], 200);
        }

        $eventRecord = PaymentWebhookEvent::create([
            'provider' => $providerCode,
            'provider_event_id' => $eventId,
            'event_type' => $eventType,
            'signature_verified' => true,
            'payload_hash' => $payloadHash ?? hash('sha256', (string) json_encode($payload)),
            'payload' => $payload,
            'processing_status' => 'received',
        ]);

        try {
            ProcessPaymentWebhookJob::dispatch($eventRecord->id);
        } catch (\Throwable $queueFailure) {
            // Free the event id so the provider retry re-ingests and re-queues
            // the event instead of being acknowledged as a duplicate.
            $eventRecord->delete();

            throw $queueFailure;
        }

        return response()->json([
            'status' => 'received',
            'event_id' => $eventRecord->id,
        ], 200);
    }
}
