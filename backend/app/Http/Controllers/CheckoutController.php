<?php

namespace App\Http\Controllers;

use App\Models\DigitalProduct;
use App\Models\Order;
use App\Models\PaymentWebhook;
use App\Models\Storefront;
use App\Services\Accounting\AccountingStreamService;
use App\Services\Payment\MockPaymentProvider;
use App\Services\Payment\PaymentProviderInterface;
use App\Services\Payment\StripePaymentProvider;
use App\Services\Tax\TaxCalculationService;
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

    public function __construct(
        protected TaxCalculationService $taxService,
        protected AccountingStreamService $accountingService,
    ) {}

    /**
     * Preview server-calculated totals (incl. VAT) before placing the order.
     * Used by checkout UIs to display the VAT line and final amount.
     */
    public function estimate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:digital_products,id'],
            'country_code' => ['nullable', 'string', 'max:3'],
        ]);

        $product = DigitalProduct::findOrFail($validated['product_id']);
        $countryCode = $this->buyerCountry($request, $validated['country_code'] ?? null);

        return response()->json([
            'data' => $this->computePricing($product, $countryCode),
        ]);
    }

    /**
     * Create a checkout intent with server-calculated totals.
     * VAT is charged against the buyer's country rate and captured on the order.
     * Idempotency key prevents double-order creation on retry.
     */
    public function createIntent(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:digital_products,id'],
            'payment_provider' => ['nullable', 'string', 'in:stripe,mock'],
            'idempotency_key' => ['required', 'string', 'max:128'],
            'country_code' => ['nullable', 'string', 'max:3'],
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
        $countryCode = $this->buyerCountry($request, $validated['country_code'] ?? null);

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
        $pricing = $this->computePricing($product, $countryCode);

        $provider = $this->resolveProvider($validated['payment_provider'] ?? 'mock');

        $order = DB::transaction(function () use ($product, $request, $validated, $pricing, $provider) {
            return Order::create([
                'order_number' => $this->generateOrderNumber(),
                'buyer_id' => $request->user()->id,
                'creator_id' => $product->creator_id,
                'product_id' => $product->id,
                'subtotal' => $pricing['subtotal'],
                'platform_fee' => $pricing['platform_fee'],
                'tax' => $pricing['tax'],
                'tax_rate' => $pricing['tax_rate'],
                'tax_country_code' => $pricing['tax_country_code'],
                'tax_type' => $pricing['tax_type'],
                'tax_name' => $pricing['tax_name'],
                'total' => $pricing['total'],
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
                'breakdown' => $pricing,
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

        $this->recordOrderRevenue($order);

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

                $this->recordOrderRevenue($order);
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

    /**
     * Determine the buyer's country: explicit checkout input, then profile country.
     * Accepts ISO2 or ISO3; normalised upstream in the tax service.
     */
    private function buyerCountry(Request $request, ?string $countryCode): ?string
    {
        if (! empty($countryCode)) {
            return $countryCode;
        }

        if ($request->user()?->country) {
            return $request->user()->country;
        }

        return null;
    }

    /**
     * Compute ground-truth checkout pricing (subtotal + platform fee + VAT).
     */
    private function computePricing(DigitalProduct $product, ?string $buyerCountryCode): array
    {
        $subtotal = round((float) $product->price, 2);
        $subtotalCents = (int) round($subtotal * 100);
        $platformFee = round($subtotal * self::PLATFORM_FEE_RATE, 2);

        $storefront = Storefront::where('user_id', $product->creator_id)->first();
        $storefrontRate = $storefront ? (float) $storefront->tax_rate : 0.0;

        $taxInfo = $this->taxService->resolveCheckoutTax($subtotalCents, $buyerCountryCode, $storefrontRate, 'commerce');
        $tax = round($taxInfo['tax_amount_cents'] / 100, 2);
        $total = round($subtotal + $platformFee + $tax, 2);

        return [
            'subtotal' => $subtotal,
            'platform_fee' => $platformFee,
            'tax' => $tax,
            'tax_rate' => $taxInfo['tax_rate_percentage'],
            'tax_name' => $taxInfo['tax_name'],
            'tax_type' => $taxInfo['tax_type'],
            'tax_country_code' => $taxInfo['country_code'],
            'total' => $total,
            'currency' => $product->currency,
        ];
    }

    /**
     * Journal the paid order into the accounting ledger + accumulate VAT liability.
     * Idempotent: the ledger entry reference is unique per order number.
     */
    private function recordOrderRevenue(Order $order): void
    {
        $this->accountingService->recordCommerceSale(
            orderNumber: $order->order_number,
            sourceId: $order->id,
            currency: $order->currency,
            grossCents: (int) round(((float) $order->subtotal) * 100),
            taxCents: (int) round(((float) $order->tax) * 100),
            taxRate: (float) $order->tax_rate,
            taxType: $order->tax_type,
            taxName: $order->tax_name,
            countryCode: $order->tax_country_code,
            platformFeeCents: (int) round(((float) $order->platform_fee) * 100),
            metadata: [
                'order_id' => $order->id,
                'buyer_id' => $order->buyer_id,
                'creator_id' => $order->creator_id,
                'product_id' => $order->product_id,
            ],
        );
    }

    private function resolveProvider(string $name): PaymentProviderInterface
    {
        return match ($name) {
            'stripe' => new StripePaymentProvider,
            default => new MockPaymentProvider,
        };
    }

    private function generateOrderNumber(): string
    {
        return 'ORD-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
    }
}