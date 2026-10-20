<?php

namespace App\Services\Payment;

use App\Enums\PaymentStatus;
use App\Enums\RefundStatus;
use App\Models\IdempotencyKey;
use App\Models\Payment;
use App\Models\Refund;
use App\Services\Payment\Contracts\RefundProviderInterface;
use App\Services\Payment\DTO\RefundRequest;
use App\Services\Payment\Exceptions\PaymentException;
use App\Services\Payment\Router\ProviderRouter;
use App\Services\Wallet\LedgerService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RefundService
{
    public function __construct(
        protected ProviderRouter $router,
        protected LedgerService $ledgerService
    ) {}

    /**
     * Issues a refund for a previously captured payment.
     *
     * @param array{
     *     payment_id: int,
     *     amount: int, // Minor units
     *     reason?: string,
     *     idempotency_key?: string
     * } $data
     */
    /**
     * The item price of a digital sale, in the payment's minor units: the payment amount scaled by
     * the item subtotal over the order total, so the buyer's fee is left out. Null when the payment
     * is not for a digital sale.
     */
    public function digitalItemShare(Payment $payment): ?int
    {
        $order = $this->digitalOrderFor($payment);
        if (! $order || (float) $order->total <= 0) {
            return null;
        }

        return (int) round($payment->amount * ((float) $order->subtotal) / (float) $order->total);
    }

    private function digitalOrderFor(Payment $payment): ?\App\Models\Order
    {
        $references = array_filter([$payment->provider_transaction_id, $payment->provider_reference]);
        if ($references === []) {
            return null;
        }

        return \App\Models\Order::whereIn('payment_intent_id', $references)
            ->whereNotNull('creator_id')
            ->first();
    }

    /**
     * A refund on a digital purchase reverses the seller's share. A full refund does this
     * automatically. A partial refund is not reversed automatically, because the share
     * would be over-clawed, and an admin alert asks for a manual decision.
     */
    private function reverseDigitalSale(Payment $payment, bool $fullyRefunded): void
    {
        $references = array_filter([$payment->provider_transaction_id, $payment->provider_reference]);
        if ($references === []) {
            return;
        }

        $order = \App\Models\Order::whereIn('payment_intent_id', $references)->first();
        if (! $order) {
            return;
        }

        if ($fullyRefunded) {
            app(\App\Services\Wallet\DigitalSaleService::class)->reverseForRefund($order);

            return;
        }

        try {
            app(\App\Services\AdminAlertService::class)->dispatch([
                'event_type' => 'digital_sale_partial_refund',
                'severity' => 'warning',
                'title' => "Partial refund on digital order #{$order->id}",
                'description' => 'A partial refund was issued on a digital purchase. The seller share was not reversed automatically. Review the sale and decide the adjustment.',
                'reference' => "order:{$order->id}",
                'affected_service' => 'digital_sales',
                'metadata' => ['order_id' => $order->id, 'payment_id' => $payment->id],
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public function issueRefund(array $data): array
    {
        $idempotencyKey = $data['idempotency_key'] ?? (string) Str::uuid();

        // 1. Check Idempotency
        $existing = IdempotencyKey::where('key', $idempotencyKey)
            ->where('scope', 'refund_create')
            ->first();

        if ($existing && $existing->response_body) {
            return $existing->response_body;
        }

        return DB::transaction(function () use ($data, $idempotencyKey) {
            $payment = Payment::where('id', $data['payment_id'])->lockForUpdate()->firstOrFail();

            if ($payment->status !== PaymentStatus::Successful && $payment->status !== PaymentStatus::PartiallyRefunded) {
                throw new PaymentException("Cannot refund a payment with status '{$payment->status->value}'.");
            }

            // Calculate total refunded amount
            $alreadyRefunded = (int) $payment->refunds()
                ->whereIn('status', [RefundStatus::Successful, RefundStatus::Processing])
                ->sum('amount');

            $refundableBalance = max(0, $payment->amount - $alreadyRefunded);
            $refundAmount = (int) $data['amount'];

            if ($refundAmount <= 0) {
                throw new PaymentException('Refund amount must be greater than zero.');
            }

            // A digital sale refunds the item price only. The buyer's fee is never refunded.
            // The cap applies to the running total, so several partial refunds cannot pass it together.
            $itemShare = $this->digitalItemShare($payment);
            if ($itemShare !== null && $alreadyRefunded + $refundAmount > $itemShare + 1) {
                throw new PaymentException(
                    "A refund on this digital sale is limited to the item price ({$itemShare} minor units). The buyer's fee is not refunded."
                );
            }

            if ($refundAmount > $refundableBalance) {
                throw new PaymentException("Requested refund of {$refundAmount} exceeds refundable balance of {$refundableBalance}.");
            }

            // Resolve Provider
            $provider = $this->router->getProvider($payment->provider);
            if (! ($provider instanceof RefundProviderInterface)) {
                throw new PaymentException("Provider '{$payment->provider}' does not support refunds.");
            }

            // Create Refund record
            $refund = Refund::create([
                'payment_id' => $payment->id,
                'amount' => $refundAmount,
                'currency' => $payment->currency,
                'reason' => $data['reason'] ?? 'Admin issued refund',
                'provider' => $payment->provider,
                'status' => RefundStatus::Pending,
                'idempotency_key' => $idempotencyKey,
            ]);

            $req = new RefundRequest(
                internalReference: $refund->internal_reference,
                paymentReference: $payment->public_reference,
                providerPaymentId: $payment->provider_transaction_id ?: $payment->provider_reference,
                amount: $refundAmount,
                currency: $payment->currency,
                reason: $refund->reason,
                idempotencyKey: $idempotencyKey
            );

            $refundRes = $provider->processRefund($req);

            $refund->update([
                'provider_refund_id' => $refundRes->providerRefundId,
                'status' => $refundRes->status,
                'failure_reason' => $refundRes->failureReason,
            ]);

            if ($refundRes->status === RefundStatus::Successful) {
                $newTotalRefunded = $alreadyRefunded + $refundAmount;
                $newPaymentStatus = ($newTotalRefunded >= $payment->amount)
                    ? PaymentStatus::Refunded
                    : PaymentStatus::PartiallyRefunded;

                $payment->update(['status' => $newPaymentStatus]);

                // No wallet balance moves here. A card refund leaves the platform's provider account, not a
                // user wallet. A digital sale's seller share is reversed by reverseDigitalSale() below, and a
                // dispute refund's buyer debit is made by DisputeRefundController / DisputeRefundSettlementService.
                // LedgerService has no journal API for a refund entry, so none is written.

                $coversSale = $newPaymentStatus === PaymentStatus::Refunded
                    || ($itemShare !== null && $newTotalRefunded >= $itemShare);
                $this->reverseDigitalSale($payment, $coversSale);
            }

            $responsePayload = [
                'success' => true,
                'refund_id' => $refund->id,
                'public_reference' => $refund->public_reference,
                'status' => $refund->status->value,
                'amount' => $refund->amount,
                'currency' => $refund->currency,
            ];

            IdempotencyKey::create([
                'key' => $idempotencyKey,
                'scope' => 'refund_create',
                'request_hash' => hash('sha256', json_encode($data)),
                'response_status' => 200,
                'response_body' => $responsePayload,
            ]);

            return $responsePayload;
        });
    }

    /**
     * Applies a refund result from a provider event (webhook).
     *
     * Returns 'applied' when the result settled the refund, 'duplicate' when the refund was already final,
     * and 'unmatched' when no single refund row can be identified. An unmatched event moves nothing and is
     * left for admin review.
     *
     * @param  array{provider_refund_id: string, refund_reference: ?string, transaction_reference: string, amount: ?int, currency: ?string, outcome: string, event_type: string}  $event
     */
    public function applyWebhookOutcome(string $provider, array $event): string
    {
        $refund = $this->matchWebhookRefund($provider, $event);

        if (! $refund) {
            Log::warning('Refund webhook matched no single refund; recorded for admin review', [
                'provider' => $provider,
                'event' => $event['event_type'],
                'transaction_reference' => $event['transaction_reference'],
            ]);

            return 'unmatched';
        }

        $wasFinal = in_array($refund->status, [RefundStatus::Successful, RefundStatus::Failed], true);

        $this->applyProviderResult(
            $refund,
            $event['outcome'] === 'successful' ? RefundStatus::Successful : RefundStatus::Failed,
            $event['outcome'] === 'successful' ? null : 'Declined by the provider ('.$event['event_type'].').',
        );

        return $wasFinal ? 'duplicate' : 'applied';
    }

    /**
     * Finds the one refund row a provider refund event belongs to, or null.
     *
     * 1. A provider refund id on the event (provider_refund_id, or refund_reference when present) that equals a
     *    stored provider_refund_id. Must be exactly one row, and the event's amount and currency must agree with it.
     * 2. Otherwise, the refund must be the only Paystack refund on the payment identified by transaction_reference
     *    (the original charge reference), with the same amount and currency. If there is more than one such refund
     *    (for example a failed attempt and its retry), the payload cannot tell them apart, so nothing is matched.
     */
    private function matchWebhookRefund(string $provider, array $event): ?Refund
    {
        $amount = $event['amount'] ?? null;
        $currency = $event['currency'] ?? null;

        $ids = array_values(array_unique(array_filter([
            (string) ($event['provider_refund_id'] ?? ''),
            (string) ($event['refund_reference'] ?? ''),
        ], fn ($id) => $id !== '')));

        if ($ids !== []) {
            $byId = Refund::where('provider', $provider)->whereIn('provider_refund_id', $ids)->get();

            if ($byId->count() > 1) {
                return null;
            }
            if ($byId->count() === 1) {
                $refund = $byId->first();
                $amountOk = $amount === null || (int) $refund->amount === (int) $amount;
                $currencyOk = $currency === null || strtoupper((string) $refund->currency) === strtoupper((string) $currency);

                return $amountOk && $currencyOk ? $refund : null;
            }
        }

        $transactionReference = (string) ($event['transaction_reference'] ?? '');
        if ($transactionReference === '' || $amount === null || $currency === null) {
            return null;
        }

        $candidates = Refund::where('provider', $provider)
            ->where('amount', (int) $amount)
            ->where('currency', strtoupper((string) $currency))
            ->whereHas('payment', fn ($q) => $q->where(function ($q) use ($transactionReference) {
                $q->where('provider_reference', $transactionReference)
                    ->orWhere('provider_transaction_id', $transactionReference)
                    ->orWhere('public_reference', $transactionReference);
            }))
            ->get();

        return $candidates->count() === 1 ? $candidates->first() : null;
    }

    /**
     * Applies a provider's final refund result. A refund that is already final does not move money
     * again. A dispute refund's buyer balance is settled after the refund, and that step is idempotent,
     * so it also runs for duplicate results (this covers a result whose settlement failed earlier).
     */
    public function applyProviderResult(Refund $refund, RefundStatus $status, ?string $failureReason = null): Refund
    {
        if (! in_array($status, [RefundStatus::Successful, RefundStatus::Failed], true)) {
            return $refund; // still pending: nothing to settle
        }

        DB::transaction(function () use ($refund, $status, $failureReason) {
            $locked = Refund::whereKey($refund->id)->lockForUpdate()->firstOrFail();

            if (in_array($locked->status, [RefundStatus::Successful, RefundStatus::Failed], true)) {
                return;
            }

            if ($status === RefundStatus::Failed) {
                $locked->update(['status' => RefundStatus::Failed, 'failure_reason' => $failureReason]);

                return;
            }

            $payment = Payment::whereKey($locked->payment_id)->lockForUpdate()->firstOrFail();

            $successfulTotal = (int) Refund::where('payment_id', $payment->id)
                ->where('status', RefundStatus::Successful)
                ->sum('amount') + (int) $locked->amount;
            $newPaymentStatus = ($successfulTotal >= $payment->amount)
                ? PaymentStatus::Refunded
                : PaymentStatus::PartiallyRefunded;
            $itemShare = $this->digitalItemShare($payment);

            $locked->update(['status' => RefundStatus::Successful, 'failure_reason' => null]);
            $payment->update(['status' => $newPaymentStatus]);

            // No platform-level refund journal entry is written here. LedgerService has no recordTransaction()
            // method (the call in issueRefund() is the same), so that entry is a known gap, not a new API.
            // The buyer's balance movement is still recorded by the ledger debit in the settlement service.

            $coversSale = $newPaymentStatus === PaymentStatus::Refunded
                || ($itemShare !== null && $successfulTotal >= $itemShare);
            $this->reverseDigitalSale($payment, $coversSale);
        });

        if (str_starts_with((string) $refund->idempotency_key, 'DISPUTE_CARD_REFUND_')) {
            app(\App\Services\Wallet\DisputeRefundSettlementService::class)->settleFromRefund($refund->fresh());
        }

        return $refund->fresh();
    }
}
