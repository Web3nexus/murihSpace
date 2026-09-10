<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessPaymentWebhookJob;
use App\Models\PaymentWebhookEvent;
use App\Services\Payment\Contracts\ProviderWebhookInterface;
use App\Services\Payment\Router\ProviderRouter;
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

            // 3. Deduplication: Check if event ID already exists
            $existing = PaymentWebhookEvent::where('provider', $providerCode)
                ->where('provider_event_id', $parsedEvent->eventId)
                ->first();

            if ($existing) {
                return response()->json([
                    'status' => 'acknowledged',
                    'message' => 'Event already processed or queued (idempotent duplicate)',
                ], 200);
            }

            // 4. Ingest Event Record
            $eventRecord = PaymentWebhookEvent::create([
                'provider' => $providerCode,
                'provider_event_id' => $parsedEvent->eventId,
                'event_type' => $parsedEvent->eventType,
                'signature_verified' => true,
                'payload_hash' => $payloadHash,
                'payload' => $parsedEvent->payload,
                'processing_status' => 'received',
            ]);

            // 5. Queue Async Processing Job
            ProcessPaymentWebhookJob::dispatch($eventRecord->id);

            // 6. Fast HTTP 200 Acknowledgment
            return response()->json([
                'status' => 'received',
                'event_id' => $eventRecord->id,
            ], 200);
        } catch (Exception $e) {
            Log::error("Webhook error for {$providerCode}: {$e->getMessage()}");
            return response()->json(['error' => 'Webhook processing failed'], 500);
        }
    }
}

