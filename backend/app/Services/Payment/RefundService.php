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

                // Record in Double-Entry Ledger
                $this->ledgerService->recordTransaction(
                    type: 'refund',
                    amount: $refundAmount,
                    currency: $payment->currency,
                    description: "Refund for payment [Ref: {$payment->public_reference}]",
                    metadata: ['payment_id' => $payment->id, 'refund_id' => $refund->id],
                    initiatedBy: $payment->user_id ?? $payment->customer_id
                );
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
}
