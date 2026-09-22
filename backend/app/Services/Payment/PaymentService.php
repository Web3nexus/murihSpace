<?php

namespace App\Services\Payment;

use App\Enums\PaymentStatus;
use App\Http\Controllers\CoinPackController as CoinPackControllerAlias;
use App\Models\CoinPurchase;
use App\Models\DepositTransaction;
use App\Models\Gift;
use App\Models\GiftTransaction;
use App\Models\IdempotencyKey;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\User;
use App\Models\Wallet;
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
            amount: $amount,
            businessType: $data['business_type'] ?? ($transactionType === 'order' ? 'commerce' : $transactionType)
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
        // 1. Fulfill Orders if linked
        if (isset($payment->metadata['order_id'])) {
            $order = Order::find($payment->metadata['order_id']);
            if ($order && $order->status !== 'completed') {
                $order->update(['status' => 'completed', 'paid_at' => now()]);
                if ($order->product) {
                    $order->product->increment('download_count');
                }
            }
        }

        // 2. Fulfill business streams (coins/gifts/top-ups) confirmed via webhook.
        //    These were previously only handled by the synchronous mock controllers.
        try {
            if (($payment->metadata['coin_pack_id'] ?? $payment->metadata['coin_pack_type'] ?? null)
                || ($payment->metadata['coin_custom'] ?? false)) {
                $this->fulfillCoinPurchase($payment);
            }

            if ($payment->metadata['wallet_topup'] ?? false) {
                $this->fulfillWalletTopup($payment);
            }

            // Commerce / fulfilment orders: money captured into escrow (held
            // for the seller) once Paddle confirms the payment.
            $fulfilmentOrderId = $payment->metadata['fulfilment_order_id']
                ?? (($payment->metadata['order_type'] ?? null) === 'fulfilment' ? ($payment->metadata['order_id'] ?? null) : null);
            if ($fulfilmentOrderId) {
                $this->captureFulfilmentEscrow($payment, (int) $fulfilmentOrderId);
            }

            if (isset($payment->metadata['gift_id'])) {
                $this->fulfillGiftPurchase($payment);
            }

        } catch (Exception $e) {
            Log::critical("Fulfillment failed for payment {$payment->public_reference}: {$e->getMessage()}", [
                'payment_id' => $payment->id,
                'transaction_type' => $payment->transaction_type,
            ]);
        }
    }

    /**
     * Credit coins after a confirmed coin-pack or custom-amount purchase.
     */
    protected function fulfillCoinPurchase(Payment $payment): void
    {
        $coinRate = CoinPackControllerAlias::coinConversionRate();
        $usdMinor = $payment->amount;

        $pack = null;
        if (! empty($payment->metadata['coin_pack_id'])) {
            $pack = \App\Models\CoinPack::find($payment->metadata['coin_pack_id']);
        }

        if ($pack) {
            $coins = (int) $pack->coins;
            $bonus = (int) $pack->bonus_coins;
            $totalCoins = $coins + $bonus;
        } else {
            $coins = (int) round(($usdMinor / 100.0) * $coinRate);
            $bonus = 0;
            $totalCoins = $coins;
        }

        if ($totalCoins < 1) {
            return;
        }

        $user = $payment->user_id ? User::find($payment->user_id) : null;
        if (! $user) {
            return;
        }

        $this->ledgerService->credit(
            user: $user,
            amount: $totalCoins,
            currency: 'USD',
            walletType: 'system',
            balanceCategory: 'available',
            type: 'coin_purchase',
            description: "Coins purchased via {$payment->provider} [Ref: {$payment->public_reference}]",
            idempotencyKey: 'COIN_'.$payment->idempotency_key,
            metadata: ['payment_id' => $payment->id, 'provider' => $payment->provider, 'coin_conversion_rate' => $coinRate],
        );

        $metadata = $payment->metadata;
        CoinPurchase::create([
            'user_id' => $user->id,
            'coin_pack_id' => $pack?->id,
            'coins' => $coins,
            'bonus_coins' => $bonus,
            'amount_paid' => $usdMinor,
            'currency' => 'USD',
            'status' => 'completed',
            'provider' => $payment->provider,
            'reference' => $payment->public_reference,
            'tax' => $metadata['tax'] ?? null,
            'total_charged' => $metadata['total_charged'] ?? $usdMinor,
            'tax_rate' => isset($metadata['tax_rate']) ? (float) $metadata['tax_rate'] : null,
            'tax_country_code' => $metadata['tax_country_code'] ?? null,
            'tax_type' => $metadata['tax_type'] ?? 'provider_handled',
            'tax_name' => $metadata['tax_name'] ?? null,
        ]);
    }

    /**
     * Credit a system wallet after a confirmed cash top-up.
     */
    protected function fulfillWalletTopup(Payment $payment): void
    {
        $user = $payment->user_id ? User::find($payment->user_id) : null;
        if (! $user || $payment->amount < 1) {
            return;
        }

        $this->ledgerService->credit(
            user: $user,
            amount: $payment->amount,
            currency: $payment->currency,
            walletType: 'system',
            balanceCategory: 'available',
            type: 'deposit',
            description: "Wallet top-up via {$payment->provider} [Ref: {$payment->public_reference}]",
            idempotencyKey: 'DEP_'.$payment->idempotency_key,
            metadata: [
                'payment_id' => $payment->id,
                'provider' => $payment->provider,
                'gross' => $payment->amount,
                'fee' => 0,
            ],
        );

        $metadata = $payment->metadata;
        DepositTransaction::create([
            'user_id' => $user->id,
            'wallet_type' => 'system',
            'idempotency_key' => $payment->idempotency_key,
            'payment_gateway' => $payment->provider,
            'gateway_reference' => $payment->public_reference,
            'amount' => $payment->amount,
            'fee_amount' => 0,
            'net_amount' => $payment->amount,
            'tax' => $metadata['tax'] ?? null,
            'total_charged' => $metadata['total_charged'] ?? $payment->amount,
            'tax_rate' => isset($metadata['tax_rate']) ? (float) $metadata['tax_rate'] : null,
            'tax_country_code' => $metadata['tax_country_code'] ?? null,
            'tax_type' => $metadata['tax_type'] ?? 'provider_handled',
            'tax_name' => $metadata['tax_name'] ?? null,
            'currency' => $payment->currency,
            'status' => 'completed',
            'wallet_credited_at' => now(),
        ]);
    }

    /**
     * Convert a confirmed direct-money gift payment into the sender's coin balance
     * and settle the underlying gift transfer (sender system -> recipient creator wallet).
     */
    protected function fulfillGiftPurchase(Payment $payment): void
    {
        $gift = Gift::find($payment->metadata['gift_id'] ?? 0);
        $sender = $payment->user_id ? User::find($payment->user_id) : null;
        $recipientId = (int) ($payment->metadata['recipient_id'] ?? 0);
        $recipient = $recipientId ? User::find($recipientId) : null;

        if (! $gift || ! $gift->is_active || ! $sender || ! $recipient) {
            return;
        }

        $coinRate = CoinPackControllerAlias::coinConversionRate();
        $grossCoins = (int) round(($payment->amount / 100.0) * $coinRate);
        $giftPrice = (int) $gift->coin_price;

        if ($grossCoins < $giftPrice) {
            Log::warning("Gift payment {$giftPrice} exceeds funded coins {$grossCoins} for payment {$payment->public_reference}");

            return;
        }

        // Fee split mirrors GiftController::send
        $feeRes = app(\App\Services\Wallet\FeeCalculatorService::class)->calculate('GIFT_RECEIVING', $giftPrice, 'USD');
        $feeAmt = (int) $feeRes['fee_amount'];
        $netEarns = (int) $feeRes['net_amount'];

        DB::transaction(function () use ($payment, $sender, $recipient, $gift, $grossCoins, $giftPrice, $feeAmt, $netEarns, $coinRate) {
            // 1. Fund the sender's coin balance with the priced amount
            $this->ledgerService->credit(
                user: $sender,
                amount: $grossCoins,
                currency: 'USD',
                walletType: 'system',
                balanceCategory: 'available',
                type: 'coin_purchase',
                description: "Coins purchased via {$payment->provider} for gift [Ref: {$payment->public_reference}]",
                idempotencyKey: 'COIN_'.$payment->idempotency_key,
                metadata: ['payment_id' => $payment->id, 'provider' => $payment->provider, 'coin_conversion_rate' => $coinRate],
            );

            // 2. Debit the gift price from the sender's system wallet
            $this->ledgerService->debit(
                user: $sender,
                amount: $giftPrice,
                currency: 'USD',
                walletType: 'system',
                balanceCategory: 'available',
                type: 'donation_out',
                description: "Gift sent to @{$recipient->username}: {$gift->name}",
                idempotencyKey: 'GIFT_'.$payment->idempotency_key.'-debit',
            );

            // 3. Credit recipient creator wallet (net of platform fee)
            $this->ledgerService->credit(
                user: $recipient,
                amount: $netEarns,
                currency: 'USD',
                walletType: 'creator',
                balanceCategory: 'available',
                type: 'creator_gift_receipt',
                description: "Gift received from @{$sender->username}: {$gift->name} (Net: {$netEarns}, Fee: {$feeAmt})",
                idempotencyKey: 'GIFT_'.$payment->idempotency_key.'-credit',
                metadata: ['sender_id' => $sender->id, 'gift_id' => $gift->id, 'fee_amount' => $feeAmt],
            );

            // 4. Credit platform revenue with the receiving fee
            if ($feeAmt > 0) {
                $this->ledgerService->creditPlatformRevenue(
                    amount: $feeAmt,
                    currency: 'USD',
                    description: "Gift receiving fee for gift #{$gift->id} (paid via {$payment->provider})",
                    idempotencyKey: 'GIFT_'.$payment->idempotency_key.'-fee',
                    metadata: ['sender_id' => $sender->id, 'recipient_id' => $recipient->id, 'gift_id' => $gift->id],
                );
            }

            GiftTransaction::create([
                'sender_id' => $sender->id,
                'recipient_id' => $recipient->id,
                'community_id' => $payment->metadata['community_id'] ?? null,
                'gift_id' => $gift->id,
                'giftable_type' => $payment->metadata['giftable_type'] ?? null,
                'giftable_id' => $payment->metadata['giftable_id'] ?? null,
                'session_id' => $payment->metadata['session_id'] ?? null,
                'coin_price' => $giftPrice,
                'creator_earns' => $netEarns,
                'platform_commission' => $feeAmt,
                'status' => 'completed',
                'is_anonymous' => (bool) ($payment->metadata['is_anonymous'] ?? false),
                'sender_display_name' => $payment->metadata['sender_display_name'] ?? $sender->name,
                'message' => $payment->metadata['message'] ?? null,
                'is_public' => (bool) ($payment->metadata['is_public'] ?? true),
                'idempotency_key' => 'PAY_GIFT_'.$payment->idempotency_key,
            ]);
        });
    }

    /**
     * Capture funds into escrow when Paddle confirms a fulfilment order's
     * payment. Journal-only — EscrowService books a balanced escrow_hold event
     * in the ORDER currency; no wallet movement occurs.
     */
    protected function captureFulfilmentEscrow(Payment $payment, int $fulfilmentOrderId): void
    {
        $order = \App\Models\FulfilmentOrder::find($fulfilmentOrderId);
        $escrow = $order ? $order->escrow : \App\Models\Escrow::where('fulfilment_order_id', $fulfilmentOrderId)->first();
        if (! $escrow) {
            Log::warning("No escrow found for fulfilment order #{$fulfilmentOrderId}; skipping escrow capture.");
            return;
        }

        app(\App\Services\Escrow\EscrowService::class)->capture($escrow);
    }

    /**
     * Alias for {@see captureFulfilmentEscrow()} used by orders resolved via
     * metadata rather than a dedicated fulfilment_order_id.
     */
    protected function captureFulfilmentOrderEscrow(Payment $payment): void
    {
        $fulfilmentOrderId = (int) ($payment->metadata['fulfilment_order_id'] ?? 0);
        if ($fulfilmentOrderId < 1) {
            return;
        }

        $this->captureFulfilmentEscrow($payment, $fulfilmentOrderId);
    }

}
