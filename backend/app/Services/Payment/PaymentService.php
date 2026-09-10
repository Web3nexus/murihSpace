<?php

namespace App\Services\Payment;

use App\Enums\PaymentStatus;
use App\Models\IdempotencyKey;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Services\Payment\Contracts\CollectionProviderInterface;
use App\Services\Payment\DTO\PaymentIntentRequest;
use App\Services\Payment\DTO\PaymentVerificationResult;
use App\Services\Payment\Exceptions\PaymentException;
use App\Services\Payment\Router\ProviderRouter;
use App\Services\Wallet\LedgerService;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PaymentService
{
    public function __construct(
        protected ProviderRouter $router,
        protected LedgerService $ledgerService
    ) {}

    /**
     * Create an internal payment and initiate checkout with the routed provider.
     * Guaranteed idempotent.
     *
     * @param array{
     *     amount: int, // Minor units
     *     currency: string,
     *     customer_id?: int|null,
     *     user_id?: int|null,
     *     customer_email: string,
     *     customer_name?: string|null,
     *     country?: string|null,
     *     payment_method?: string,
     *     transaction_type: string,
     *     return_url?: string|null,
     *     idempotency_key: string,
     *     metadata?: array,
     *     fees?: int
     * } $data
     */
    public function initializePayment(array $data): array
    {
        $idempotencyKey = $data['idempotency_key'] ?? (string) Str::uuid();

        // 1. Check Idempotency Key
        $existing = IdempotencyKey::where('key', $idempotencyKey)
            ->where('scope', 'payment_create')
            ->first();

        if ($existing && $existing->response_body) {
            return $existing->response_body;
        }

        $currency = strtoupper($data['currency'] ?? 'NGN');
        $country = isset($data['country']) ? strtoupper($data['country']) : null;
        $paymentMethod = $data['payment_method'] ?? 'card';
        $amount = (int) $data['amount'];
        $transactionType = $data['transaction_type'] ?? 'order';
        $fees = (int) ($data['fees'] ?? 0);
        $netAmount = max(0, $amount - $fees);

        // 2. Ask Provider Router for the optimal provider
        $provider = $this->router->resolve(
            transactionType: 'payment',
            currency: $currency,
            country: $country,
            paymentMethod: $paymentMethod,
            amount: $amount
        );

        if (! ($provider instanceof CollectionProviderInterface)) {
            throw new PaymentException("Selected provider '{$provider->providerCode()}' does not support payment collection.");
        }

        // 3. Create Internal Payment Record (Pending)
        $payment = DB::transaction(function () use ($data, $amount, $currency, $fees, $netAmount, $transactionType, $paymentMethod, $provider, $idempotencyKey) {
            return Payment::create([
                'provider' => $provider->providerCode(),
                'customer_id' => $data['customer_id'] ?? null,
                'user_id' => $data['user_id'] ?? null,
                'business_id' => $data['business_id'] ?? null,
                'transaction_type' => $transactionType,
                'payment_method' => $paymentMethod,
                'amount' => $amount,
                'currency' => $currency,
                'fees' => $fees,
                'net_amount' => $netAmount,
                'status' => PaymentStatus::Pending,
                'idempotency_key' => $idempotencyKey,
                'metadata' => $data['metadata'] ?? [],
            ]);
        });

        // 4. Create Payment Intent with Provider
        $intentReq = new PaymentIntentRequest(
            internalReference: $payment->internal_reference,
            publicReference: $payment->public_reference,
            amount: $amount,
            currency: $currency,
            paymentMethod: $paymentMethod,
            customerEmail: $data['customer_email'],
            customerName: $data['customer_name'] ?? null,
            returnUrl: $data['return_url'] ?? null,
            metadata: array_merge($data['metadata'] ?? [], [
                'payment_id' => $payment->id,
            ]),
            idempotencyKey: $idempotencyKey,
        );

        $startTime = hrtime(true);
        try {
            $intentRes = $provider->createPaymentIntent($intentReq);
            $durationMs = (int) round((hrtime(true) - $startTime) / 1e6);

            // Update payment with provider reference
            $payment->update([
                'provider_reference' => $intentRes->providerReference,
                'provider_transaction_id' => $intentRes->providerTransactionId,
                'status' => PaymentStatus::Processing,
            ]);

            // Log attempt
            PaymentAttempt::create([
                'payment_id' => $payment->id,
                'provider' => $provider->providerCode(),
                'provider_reference' => $intentRes->providerReference,
                'duration_ms' => $durationMs,
                'status' => 'initiated',
            ]);

            $responsePayload = [
                'success' => true,
                'payment_id' => $payment->id,
                'public_reference' => $payment->public_reference,
                'amount' => $payment->amount,
                'currency' => $payment->currency,
                'status' => $payment->status->value,
                'redirect_url' => $intentRes->redirectUrl,
                'client_secret' => $intentRes->clientSecret,
            ];

            // Store in Idempotency table
            IdempotencyKey::updateOrCreate(
                ['key' => $idempotencyKey, 'scope' => 'payment_create'],
                [
                    'user_id' => $data['customer_id'] ?? null,
                    'request_hash' => hash('sha256', json_encode($data)),
                    'response_status' => 200,
                    'response_body' => $responsePayload,
                ]
            );

            return $responsePayload;
        } catch (Exception $e) {
            $durationMs = (int) round((hrtime(true) - $startTime) / 1e6);
            $payment->update([
                'status' => PaymentStatus::Failed,
                'failure_reason' => $e->getMessage(),
            ]);

            PaymentAttempt::create([
                'payment_id' => $payment->id,
                'provider' => $provider->providerCode(),
                'duration_ms' => $durationMs,
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Finalize payment server-side after verified webhook or re-verification API.
     * Uses atomic row locking (lockForUpdate) to prevent double processing.
     */
    public function finalizePayment(Payment $payment, PaymentVerificationResult $verification): bool
    {
        return DB::transaction(function () use ($payment, $verification) {
            // Re-fetch payment with lock
            $lockedPayment = Payment::where('id', $payment->id)->lockForUpdate()->first();

            if (! $lockedPayment) {
                return false;
            }

            // If already successful, ignore duplicate finalization
            if ($lockedPayment->status === PaymentStatus::Successful) {
                Log::info("Payment {$lockedPayment->public_reference} is already successful. Duplicate skipped.");

                return true;
            }

            if ($verification->isSuccessful) {
                // Verify amount and currency match internal record
                if ($verification->amount !== null && $verification->amount !== $lockedPayment->amount) {
                    Log::critical("Amount mismatch for payment {$lockedPayment->public_reference}: expected {$lockedPayment->amount}, got {$verification->amount}");
                    $lockedPayment->update([
                        'status' => PaymentStatus::Failed,
                        'failure_reason' => 'Amount verification mismatch.',
                    ]);

                    return false;
                }

                if ($verification->currency !== null && strtoupper($verification->currency) !== strtoupper($lockedPayment->currency)) {
                    Log::critical("Currency mismatch for payment {$lockedPayment->public_reference}: expected {$lockedPayment->currency}, got {$verification->currency}");
                    $lockedPayment->update([
                        'status' => PaymentStatus::Failed,
                        'failure_reason' => 'Currency verification mismatch.',
                    ]);

                    return false;
                }

                $lockedPayment->update([
                    'status' => PaymentStatus::Successful,
                    'provider_transaction_id' => $verification->providerTransactionId ?? $lockedPayment->provider_transaction_id,
                    'paid_at' => now(),
                ]);

                // Record in Double-Entry Ledger and trigger business fulfillment
                $this->onPaymentSuccessful($lockedPayment);

                return true;
            } else {
                $lockedPayment->update([
                    'status' => $verification->status,
                    'failure_reason' => $verification->failureReason ?? 'Payment verification failed.',
                ]);

                return false;
            }
        });
    }

    /**
     * Handle business actions and ledger transactions upon verified payment.
     */
    protected function onPaymentSuccessful(Payment $payment): void
    {
        // 1. Post to double-entry ledger
        try {
            if ($payment->user_id) {
                // If it's a creator sale, record gross, fees, and creator net credit
                $this->ledgerService->recordTransaction(
                    type: 'payment',
                    amount: $payment->amount,
                    currency: $payment->currency,
                    description: "Payment for {$payment->transaction_type} [Ref: {$payment->public_reference}]",
                    metadata: [
                        'payment_id' => $payment->id,
                        'public_reference' => $payment->public_reference,
                        'provider' => $payment->provider,
                        'fees' => $payment->fees,
                        'net_amount' => $payment->net_amount,
                    ],
                    initiatedBy: $payment->customer_id ?? $payment->user_id
                );
            }
        } catch (Exception $e) {
            Log::error("Failed to record ledger entry for payment {$payment->public_reference}: {$e->getMessage()}");
        }

        // 2. Fulfill Orders if linked
        if (isset($payment->metadata['order_id'])) {
            $order = Order::find($payment->metadata['order_id']);
            if ($order && $order->status !== 'completed') {
                $order->update(['status' => 'completed', 'paid_at' => now()]);
                if ($order->product) {
                    $order->product->increment('download_count');
                }
            }
        }
    }
}
