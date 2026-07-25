<?php

namespace App\Http\Controllers;

use App\Models\DigitalProduct;
use App\Models\Order;
use App\Models\PaymentWebhook;
use App\Services\Payment\MockPaymentProvider;
use App\Services\Payment\PaymentProviderInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CheckoutController extends Controller
{
    /**
     * Platform fee percentage (10%).
     */
    public const PLATFORM_FEE_RATE = 0.10;

    /**
     * Create a checkout intent with server-calculated totals.
     * Idempotency key prevents double-order creation on retry.
     */
    public function createIntent(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:digital_products,id'],
            'payment_provider' => ['nullable', 'string', 'in:stripe,mock'],
            'idempotency_key' => ['required', 'string', 'max:128'],
        ]);

        // Idempotency: return existing order for same key
        $existing = Order::where('idempotency_key', $validated['idempotency_key'])->first();
        if ($existing) {
            return response()->json([
                'message' => 'Existing order returned (idempotent).',
                'data' => $existing->load(['product', 'creator']),
            ]);
        }

        $product = DigitalProduct::findOrFail($validated['product_id']);

        // Free products don't need a payment intent
        if ($product->is_free) {
            $order = DB::transaction(function () use ($product, $request, $validated) {
                return Order::create([
                    'order_number' => $this->generateOrderNumber(),
                    'buyer_id' => $request->user()->id,
                    'creator_id' => $product->creator_id,
                    'product_id' => $product->id,
                    'subtotal' => 0.00,
                    'platform_fee' => 0.00,
                    'total' => 0.00,
                    'currency' => $product->currency,
                    'status' => 'completed',
                    'payment_provider' => 'mock',
                    'idempotency_key' => $validated['idempotency_key'],
                    'paid_at' => now(),
                ]);
            });

            $product->increment('download_count');

            return response()->json([
                'message' => 'Free product unlocked.',
                'data' => $order->load(['product', 'creator']),
                'is_free' => true,
            ], 201);
        }

        // Server-calculated totals (never trust client-side price)
        $subtotal = round((float) $product->price, 2);
        $platformFee = round($subtotal * self::PLATFORM_FEE_RATE, 2);
        $total = round($subtotal + $platformFee, 2);

        $provider = $this->resolveProvider($validated['payment_provider'] ?? 'mock');

        $order = DB::transaction(function () use ($product, $request, $validated, $subtotal, $platformFee, $total, $provider) {
            return Order::create([
                'order_number' => $this->generateOrderNumber(),
                'buyer_id' => $request->user()->id,
                'creator_id' => $product->creator_id,
                'product_id' => $product->id,
                'subtotal' => $subtotal,
                'platform_fee' => $platformFee,
                'total' => $total,
                'currency' => $product->currency,
                'status' => 'pending',
                'payment_provider' => $provider->providerName(),
                'idempotency_key' => $validated['idempotency_key'],
            ]);
        });

        // Create provider payment intent
        $intentData = $provider->createCheckoutIntent($order);
        $order->update(['payment_intent_id' => $intentData['intent_id'], 'status' => 'processing']);

        return response()->json([
            'message' => 'Checkout intent created.',
            'data' => [
                'order' => $order->fresh()->load(['product', 'creator']),
                'intent' => $intentData,
                'breakdown' => [
                    'subtotal' => $subtotal,
                    'platform_fee' => $platformFee,
                    'total' => $total,
                    'currency' => $product->currency,
                ],
            ],
        ], 201);
    }

    /**
     * Complete a mock purchase instantly (test mode only).
     */
    public function completeMock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id' => ['required', 'integer', 'exists:orders,id'],
        ]);

        $order = Order::where('id', $validated['order_id'])
            ->where('buyer_id', $request->user()->id)
            ->where('payment_provider', 'mock')
            ->firstOrFail();

        if ($order->status === 'completed') {
            return response()->json(['message' => 'Order already completed.', 'data' => $order]);
        }

        $order->update(['status' => 'completed', 'paid_at' => now()]);
        $order->product()->increment('download_count');

        return response()->json([
            'message' => 'Mock purchase completed successfully.',
            'data' => $order->fresh()->load(['product', 'creator']),
        ]);
    }

    /**
     * Idempotent payment webhook handler.
     * Deduplicates via payment_webhooks.event_id unique constraint.
     */
    public function handleWebhook(Request $request, string $provider): JsonResponse
    {
        $paymentProvider = $this->resolveProvider($provider);
        $event = $paymentProvider->verifyWebhook($request);

        if (! $event) {
            return response()->json(['message' => 'Invalid or unverifiable webhook.'], 400);
        }

        // Idempotency: skip if already processed
        if (PaymentWebhook::where('event_id', $event['event_id'])->exists()) {
            return response()->json(['message' => 'Webhook already processed.', 'status' => 'ignored']);
        }

        $webhookRecord = PaymentWebhook::create([
            'provider' => $provider,
            'event_id' => $event['event_id'],
            'event_type' => $event['event_type'],
            'payload' => $request->json()->all(),
            'status' => 'processed',
        ]);

        // Handle payment success events
        if (in_array($event['event_type'], ['payment.completed', 'payment_intent.succeeded', 'checkout.session.completed'])) {
            $order = Order::where('payment_intent_id', $event['intent_id'])
                ->whereIn('status', ['pending', 'processing'])
                ->first();

            if ($order) {
                $order->update(['status' => 'completed', 'paid_at' => now()]);
                $order->product()->increment('download_count');
            }
        }

        // Handle payment failure events
        if (in_array($event['event_type'], ['payment.failed', 'payment_intent.payment_failed'])) {
            Order::where('payment_intent_id', $event['intent_id'])
                ->whereIn('status', ['pending', 'processing'])
                ->update(['status' => 'failed']);
        }

        return response()->json(['message' => 'Webhook processed.', 'event_id' => $event['event_id']]);
    }

    private function resolveProvider(string $name): PaymentProviderInterface
    {
        return match ($name) {
            'mock' => new MockPaymentProvider,
            default => new MockPaymentProvider, // Stripe integration added in future sprint
        };
    }

    private function generateOrderNumber(): string
    {
        return 'ORD-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
    }
}
