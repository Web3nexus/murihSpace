<?php

namespace App\Http\Controllers;

use App\Models\DigitalProduct;
use App\Models\Order;
use App\Models\Payment;
use App\Services\Payment\Contracts\CollectionProviderInterface;
use App\Services\Payment\PaymentService;
use App\Services\Payment\Router\ProviderRouter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    public function __construct(
        protected PaymentService $paymentService,
        protected ProviderRouter $router
    ) {}

    /**
     * Public payment methods available for checkout.
     */
    public function methods(Request $request): JsonResponse
    {
        $currency = strtoupper($request->query('currency', 'NGN'));
        $country = $request->query('country') ? strtoupper($request->query('country')) : null;

        $methods = [
            [
                'code' => 'card',
                'name' => 'Debit or Credit Card',
                'icons' => ['visa', 'mastercard', 'verve'],
            ],
            [
                'code' => 'bank_transfer',
                'name' => 'Direct Bank Transfer / Virtual Account',
                'icons' => ['bank'],
            ],
        ];

        // Mobile money for African regions
        if (in_array($currency, ['KES', 'GHS', 'UGX', 'TZS', 'RWF', 'XOF', 'XAF'])) {
            $methods[] = [
                'code' => 'mobile_money',
                'name' => 'Mobile Money (M-Pesa, MTN, Airtel)',
                'icons' => ['mobile_money'],
            ];
        }

        return response()->json([
            'currency' => $currency,
            'country' => $country,
            'methods' => $methods,
        ]);
    }

    /**
     * Initialize a payment intent for checkout.
     * Guaranteed safe against price manipulation (server-calculated).
     */
    public function initialize(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:digital_products,id'],
            'order_id' => ['nullable', 'integer', 'exists:orders,id'],
            'payment_method' => ['nullable', 'string', 'in:card,bank_transfer,mobile_money,wallet'],
            'country' => ['nullable', 'string', 'size:2'],
            'currency' => ['nullable', 'string', 'size:3'],
            'return_url' => ['nullable', 'url'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $user = $request->user();
        $idempotencyKey = $validated['idempotency_key'] ?? (string) Str::uuid();

        // 1. Resolve product/order details
        $amount = 0;
        $currency = 'NGN';
        $transactionType = 'digital_product';
        $orderId = null;
        $fees = 0;

        if (!empty($validated['order_id'])) {
            $order = Order::where('id', $validated['order_id'])
                ->where('buyer_id', $user->id)
                ->firstOrFail();

            $amount = (int) round(((float) $order->total) * 100);
            $currency = $order->currency;
            $fees = (int) round(((float) $order->platform_fee) * 100);
            $orderId = $order->id;
            $transactionType = 'order';
        } elseif (!empty($validated['product_id'])) {
            $product = DigitalProduct::findOrFail($validated['product_id']);
            $amount = (int) round(((float) $product->price) * 100);
            $currency = $product->currency;
            $fees = (int) round($amount * 0.10); // 10% platform fee
            $transactionType = 'digital_product';
        } else {
            return response()->json(['error' => 'Must provide either product_id or order_id'], 422);
        }

        $paymentResult = $this->paymentService->initializePayment([
            'customer_id' => $user->id,
            'user_id' => $user->id,
            'customer_email' => $user->email,
            'customer_name' => $user->name,
            'amount' => $amount,
            'currency' => $currency,
            'country' => $validated['country'] ?? 'NG',
            'payment_method' => $validated['payment_method'] ?? 'card',
            'transaction_type' => $transactionType,
            'return_url' => $validated['return_url'] ?? null,
            'idempotency_key' => $idempotencyKey,
            'fees' => $fees,
            'metadata' => [
                'order_id' => $orderId,
                'product_id' => $validated['product_id'] ?? null,
            ],
        ]);

        return response()->json($paymentResult, 201);
    }

    /**
     * Check transaction status.
     * Note: Frontend CANNOT set payment status to success! Only checks backend state.
     */
    public function status(string $reference): JsonResponse
    {
        $payment = Payment::where('public_reference', $reference)
            ->orWhere('internal_reference', $reference)
            ->firstOrFail();

        // If pending/processing, perform on-demand server-side verification check
        if ($payment->status === \App\Enums\PaymentStatus::Pending || $payment->status === \App\Enums\PaymentStatus::Processing) {
            try {
                $provider = $this->router->getProvider($payment->provider);
                if ($provider instanceof CollectionProviderInterface) {
                    $verifyRef = $payment->provider_transaction_id ?: $payment->provider_reference ?: $payment->public_reference;
                    $result = $provider->verifyPayment($verifyRef);

                    if ($result->isSuccessful) {
                        $this->paymentService->finalizePayment($payment, $result);
                        $payment->refresh();
                    }
                }
            } catch (\Exception $e) {
                // Keep existing status if transient network issue
            }
        }

        return response()->json([
            'public_reference' => $payment->public_reference,
            'status' => $payment->status->value,
            'amount' => $payment->amount,
            'currency' => $payment->currency,
            'paid_at' => $payment->paid_at?->toISOString(),
        ]);
    }
}
