<?php

namespace App\Http\Controllers;

use App\Models\DisputeRefund;
use App\Models\Order;
use App\Models\WalletHold;
use App\Services\Payment\Exceptions\PaymentException;
use App\Services\Payment\RefundService;
use App\Services\Wallet\DigitalSaleService;
use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DisputeRefundController extends Controller
{
    public function __construct(
        private readonly DigitalSaleService $sales,
        private readonly RefundService $refunds,
        private readonly LedgerService $ledger,
    ) {}

    /** The buyer's refund balances from disputes they won. */
    public function index(Request $request): JsonResponse
    {
        $rows = DisputeRefund::where('buyer_id', $request->user()->id)->latest()->get();

        return response()->json(['data' => $rows]);
    }

    /**
     * Sends a won dispute's refund back to the card that paid. The balance is debited only after the
     * provider accepts the refund, so the money never leaves twice.
     */
    public function refundToCard(Request $request, int $id): JsonResponse
    {
        $row = DisputeRefund::findOrFail($id);
        if ((int) $row->buyer_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        if ($row->status !== 'available') {
            return response()->json(['message' => 'This refund has already been sent to the card.', 'code' => 'ALREADY_REFUNDED'], 409);
        }

        $order = Order::findOrFail($row->order_id);
        $payment = $this->sales->paymentForOrder($order);
        if (! $payment) {
            return response()->json(['message' => 'The original card payment for this order could not be found.', 'code' => 'PAYMENT_NOT_FOUND'], 422);
        }

        // The buyer's wallet and this refund row stay locked until the refund is settled. A spend
        // waits for the lock, so the balance checked here is still there when the debit runs. Otherwise
        // the card would be refunded while the balance is spent, and the buyer would keep both.
        return DB::transaction(function () use ($request, $row, $order, $payment) {
            $locked = DisputeRefund::whereKey($row->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'available') {
                return response()->json(['message' => 'This refund has already been sent to the card.', 'code' => 'ALREADY_REFUNDED'], 409);
            }

            $wallet = \App\Models\Wallet::where('user_id', $locked->buyer_id)->where('wallet_type', 'system')->lockForUpdate()->first();

            // A balance held after an earlier pending result is no longer in available, so the hold stands in for it.
            $activeHold = WalletHold::where('reference_type', 'dispute_refund')
                ->where('reference_id', (string) $locked->id)
                ->where('status', 'active')
                ->first();

            // The balance has to still be there. If it was spent, only part of it can go back to the card.
            if (! $wallet || (! $activeHold && (int) $wallet->available < $locked->amount_usd)) {
                return response()->json([
                    'message' => 'Part of this refund balance has been used. It can only be sent to the card while the full amount is still here.',
                    'code' => 'BALANCE_USED',
                ], 422);
            }

            try {
                $result = $this->refunds->issueRefund([
                    'payment_id' => $payment->id,
                    'amount' => (int) round((float) $locked->original_amount * 100),
                    'reason' => "Dispute won: refund to original card for order #{$order->id}",
                    'idempotency_key' => $this->refundAttemptKey($locked, $payment),
                ]);
            } catch (PaymentException $e) {
                $locked->update(['failure_reason' => $e->getMessage()]);

                return response()->json(['message' => $e->getMessage(), 'code' => 'REFUND_FAILED'], 422);
            }

            if (($result['status'] ?? null) !== 'successful') {
                $locked->update(['failure_reason' => 'The provider has not confirmed the refund yet.']);

                // The card may still be refunded, so the balance must not stay spendable. It is held
                // (moved out of available) once per refund. A retry reads the cached pending result, so the
                // hold is not placed again. A failed refund keeps the balance free.
                if (($result['status'] ?? null) !== 'failed' && ! $activeHold) {
                    $this->ledger->placeHold(
                        user: $request->user(),
                        amount: (int) $locked->amount_usd,
                        walletType: 'system',
                        balanceCategory: 'reserved',
                        reason: "Dispute refund to card awaiting provider confirmation for order #{$locked->order_id}",
                        refType: 'dispute_refund',
                        refId: (string) $locked->id,
                    );
                }

                return response()->json([
                    'message' => 'The provider has not confirmed the refund yet. The balance is held until it is confirmed.',
                    'code' => 'REFUND_PENDING',
                    'refund_status' => $result['status'] ?? null,
                ], 202);
            }

            // A hold from an earlier pending result returns to available first, so the debit below takes it.
            if ($activeHold) {
                $this->ledger->releaseHold($activeHold);
            }

            $this->ledger->debit(
                user: (int) $locked->buyer_id,
                amount: (int) $locked->amount_usd,
                currency: 'USD',
                walletType: 'system',
                balanceCategory: 'available',
                type: 'dispute_refund_to_card',
                description: "Refunded to the original card for order #{$locked->order_id}",
                idempotencyKey: "DISPUTE_CARD_REFUND_{$locked->id}_DEBIT",
                metadata: ['order_id' => $locked->order_id, 'provider_refund_id' => $result['refund_id'] ?? null],
            );

            $locked->update([
                'status' => 'refunded_to_card',
                'provider_refund_id' => (string) ($result['public_reference'] ?? $result['refund_id'] ?? ''),
                'refunded_at' => now(),
            ]);

            return response()->json(['data' => $locked->fresh()]);
        });
    }

    /**
     * The provider request key for this dispute refund. It stays the same while a refund is pending, so
     * a retry reads the cached result and does not refund twice. After a failed refund it changes, so the
     * retry is a new provider request.
     */
    private function refundAttemptKey(DisputeRefund $row, \App\Models\Payment $payment): string
    {
        $failed = \App\Models\Refund::where('payment_id', $payment->id)
            ->where('status', \App\Enums\RefundStatus::Failed)
            ->get()
            ->filter(fn ($r) => \App\Services\Wallet\DisputeRefundSettlementService::disputeIdFromKey($r->idempotency_key) === (int) $row->id)
            ->count();

        return $failed === 0 ? "DISPUTE_CARD_REFUND_{$row->id}" : "DISPUTE_CARD_REFUND_{$row->id}_".($failed + 1);
    }
}
