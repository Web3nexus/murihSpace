<?php

namespace App\Services\Wallet;

use App\Enums\RefundStatus;
use App\Models\AuditLog;
use App\Models\DisputeRefund;
use App\Models\Refund;
use App\Models\WalletHold;
use Illuminate\Support\Facades\DB;

/**
 * Settles the buyer's balance for a dispute refund once the provider's refund result is known.
 *
 *  - successful: release the hold, then debit the balance once (idempotency key on the debit).
 *  - failed:     release the hold, so the balance is available again.
 *  - anything else, or a repeated result: no change.
 */
class DisputeRefundSettlementService
{
    public function __construct(private readonly LedgerService $ledger) {}

    public static function disputeIdFromKey(?string $key): ?int
    {
        return preg_match('/^DISPUTE_CARD_REFUND_(\d+)(?:_\d+)?$/', (string) $key, $m) ? (int) $m[1] : null;
    }

    public function settleFromRefund(Refund $refund): void
    {
        $disputeId = self::disputeIdFromKey($refund->idempotency_key);
        if ($disputeId === null) {
            return;
        }

        DB::transaction(function () use ($refund, $disputeId) {
            $row = DisputeRefund::whereKey($disputeId)->lockForUpdate()->first();
            if (! $row || $row->status === 'refunded_to_card') {
                return; // unknown, or already settled: a duplicate result does nothing
            }

            $hold = WalletHold::where('reference_type', 'dispute_refund')
                ->where('reference_id', (string) $row->id)
                ->where('status', 'active')
                ->lockForUpdate()
                ->first();

            if ($refund->status === RefundStatus::Successful) {
                if ($hold) {
                    $this->ledger->releaseHold($hold);
                }

                $this->ledger->debit(
                    user: (int) $row->buyer_id,
                    amount: (int) $row->amount_usd,
                    currency: 'USD',
                    walletType: 'system',
                    balanceCategory: 'available',
                    type: 'dispute_refund_to_card',
                    description: "Refunded to the original card for order #{$row->order_id}",
                    idempotencyKey: "DISPUTE_CARD_REFUND_{$row->id}_DEBIT",
                    metadata: ['order_id' => $row->order_id, 'provider_refund_id' => $refund->provider_refund_id],
                );

                $row->update([
                    'status' => 'refunded_to_card',
                    'provider_refund_id' => (string) ($refund->provider_refund_id ?? $refund->public_reference),
                    'refunded_at' => now(),
                    'failure_reason' => null,
                ]);
                $this->audit('refund.settled', $row, ['refund_id' => $refund->id, 'amount_usd' => $row->amount_usd]);

                return;
            }

            if ($refund->status === RefundStatus::Failed && $hold) {
                $this->ledger->releaseHold($hold);
                $row->update(['failure_reason' => 'The card refund was declined by the provider. The balance is available again.']);
                $this->audit('refund.released', $row, ['refund_id' => $refund->id, 'amount_usd' => $row->amount_usd]);
            }
        });
    }

    private function audit(string $action, DisputeRefund $row, array $metadata): void
    {
        AuditLog::create([
            'user_id' => null,
            'action' => $action,
            'resource_type' => 'dispute_refund',
            'resource_id' => (string) $row->id,
            'metadata' => $metadata,
        ]);
    }
}
