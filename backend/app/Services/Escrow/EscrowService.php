<?php

namespace App\Services\Escrow;

use App\Enums\PaymentStatus;
use App\Models\Escrow;
use App\Models\FulfilmentOrder;
use App\Models\FulfilmentPayout;
use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\Payment;
use App\Services\Payment\Exceptions\PaymentException;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * EscrowService — journal-only escrow ledgering in the ORDER currency.
 *
 * Paddle is the collection interface (Merchant of Record, cash held in Paddle's
 * treasury). The internal double-entry journal is the ONLY book of record for
 * what the platform owes the seller, denominated in the order currency.
 *
 * We deliberately do NOT touch Wallet rows (no buyer/seller wallet credit/debit
 * and no movement between wallet balance categories). Money is never moved
 * between buyer/seller wallets during the escrow lifecycle:
 *
 *   capture  -> escrow_hold  (journal: buyer obligation credited, platform
 *                             liability debited — money now held)
 *   release  -> escrow_release + FulfilmentPayout (journal: seller credited the
 *                             net amount owed, platform revenue + fee) +
 *                             dispute resolution if any
 *   refund   -> escrow_refund (journal: obligation reversed back to buyer)
 *
 * Every event is a BALANCED LedgerTransaction whose LedgerEntry rows carry
 * running balance_before/balance_after derived from the journal itself (no
 * Wallet row is read or written). Payout settlement is recorded only as
 * FulfilmentPayout + journal leg; the actual cash transfer to the seller runs
 * through the existing payout pipeline (Paddle payouts / bank transfer).
 */
class EscrowService
{
    /* ── Journal internals ─────────────────────────────────────────────── */

    /**
     * Derive the current journal balance for one (account dimension, currency).
     * This is a pure journal read — no Wallet row is involved.
     */
    protected function currentBalance(
        string $accountType,
        string $walletType,
        string $balanceCategory,
        ?int $userId,
        string $currency,
    ): int {
        return (int) LedgerEntry::where('account_type', $accountType)
            ->where('wallet_type', $walletType)
            ->where('balance_category', $balanceCategory)
            ->where('currency', strtoupper($currency))
            ->when($userId !== null, fn ($q) => $q->where('user_id', $userId))
            ->when($userId === null, fn ($q) => $q->whereNull('user_id'))
            ->sum('amount');
    }

    /**
     * Book a balanced journal event (debits === credits) for one escrow.
     * Idempotent per idempotency key.
     *
     * @param array<int, array{
     *     account_type: string,
     *     wallet_type: string,
     *     balance_category: string,
     *     user_id: int|null,
     *     entry_type: string, // debit|credit
     *     amount: int,
     * }> $legs
     */
    protected function book(
        Escrow $escrow,
        string $type,
        string $description,
        array $legs,
        ?string $idempotencyKey = null,
        ?int $initiatedBy = null,
    ): LedgerTransaction {
        if ($idempotencyKey) {
            $existing = LedgerTransaction::where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing->load('entries');
            }
        }

        $currency = strtoupper($escrow->currency);

        $txn = DB::transaction(function () use ($escrow, $type, $description, $legs, $currency) {
            $ledgerTxn = LedgerTransaction::create([
                'type'        => $type,
                'status'      => 'completed',
                'description' => $description,
                'metadata'    => [
                    'escrow_id'             => $escrow->id,
                    'fulfilment_order_id'   => $escrow->fulfilment_order_id,
                    'order_id'              => $escrow->order_id,
                    'amount'                => $escrow->amount,
                    'currency'              => $currency,
                ],
            ]);

            foreach ($legs as $leg) {
                $balanceBefore = $this->currentBalance(
                    $leg['account_type'],
                    $leg['wallet_type'],
                    $leg['balance_category'],
                    $leg['user_id'],
                    $currency,
                );
                $sign         = $leg['entry_type'] === 'credit' ? 1 : -1;
                $balanceAfter = $balanceBefore + ($sign * (int) $leg['amount']);

                LedgerEntry::create([
                    'ledger_transaction_id' => $ledgerTxn->id,
                    'account_type'          => $leg['account_type'],
                    'wallet_type'           => $leg['wallet_type'],
                    'balance_category'      => $leg['balance_category'],
                    'user_id'               => $leg['user_id'],
                    'entry_type'            => $leg['entry_type'],
                    'amount'                => (int) $leg['amount'],
                    'currency'              => $currency,
                    'balance_before'        => $balanceBefore,
                    'balance_after'         => $balanceAfter,
                ]);
            }

            $ledgerTxn->update(['idempotency_key' => $idempotencyKey ?? $ledgerTxn->id]);

            if ($idempotencyKey) {
                $ledgerTxn->update(['idempotency_key' => $idempotencyKey]);
            }

            return $ledgerTxn;
        });

        return $txn->load('entries');
    }

    /* ── Capture ───────────────────────────────────────────────────────── */

    /**
     * Capture confirmed funds into escrow (order confirmed, escrow held).
     * Books an escrow_hold journal event idempotently.
     */
    public function capture(Escrow $escrow, ?int $capturedBy = null, ?string $note = null): LedgerTransaction
    {
        if ($escrow->status !== 'held') {
            $this->book(
                escrow: $escrow,
                type: 'escrow_hold',
                description: "Escrow #{$escrow->id} captured (held) — order confirmed".($note ? ': '.$note : ''),
                legs: [
                    [
                        'account_type'     => 'user_wallet',
                        'wallet_type'      => 'system',
                        'balance_category' => 'escrow',
                        'user_id'          => $escrow->buyer_id,
                        'entry_type'       => 'credit',
                        'amount'           => $escrow->amount,
                    ],
                    [
                        'account_type'     => 'platform_liability',
                        'wallet_type'      => 'system',
                        'balance_category' => 'escrow',
                        'user_id'          => null,
                        'entry_type'       => 'debit',
                        'amount'           => $escrow->amount,
                    ],
                ],
                idempotencyKey: 'ESCROW_CAPTURE_'.$escrow->id,
                initiatedBy: $capturedBy,
            );

            $escrow->update(['status' => 'held', 'captured_at' => now()]);

            $order = FulfilmentOrder::find($escrow->fulfilment_order_id);
            if ($order && $order->status === 'pending') {
                $order->update(['status' => 'confirmed', 'paid_at' => now()]);
            }
        }

        return $escrow->ledgerTransaction;
    }

    /* ── Release ───────────────────────────────────────────────────────── */

    /**
     * Release a held escrow to the seller: book escrow_release journal +
     * create a FulfilmentPayout record (the payout pipeline settles it).
     */
    public function release(Escrow $escrow, ?int $releasedBy = null, ?string $note = null): FulfilmentPayout
    {
        if ($escrow->status !== 'held') {
            throw new PaymentException(
                "Escrow #{$escrow->id} cannot be released (current: {$escrow->status}).",
                'ESCROW_NOT_HELD',
                409,
            );
        }

        $order = FulfilmentOrder::find($escrow->fulfilment_order_idonti);
        $gross = (int) $escrow->amount;
        $fee   = (int) ($order->platform_fee ?? 0);
        $net   = max(0, $gross - $fee);
        $payout = FulfilmentPayout::create([
            'creator_id'          => $escrow->seller_id,
            'fulfilment_order_id' => $escrow->fulfilment_order_id,
            'gross_amount'        => $gross,
            'platform_fee'        => $fee,
            'net_amount'          => $net,
            'currency'            => $escrow->currency,
            'status'              => 'held',
        ]);

        $this->book(
            escrow: $escrow,
            type: 'escrow_release',
            description: "Escrow #{$escrow->id} released to seller".($note ? ': '.$note : ''),
            legs: [
                [
                    'account_type'     => 'platform_liability',
                    'wallet_type'      => 'system',
                    'balance_category' => 'escrow',
                    'user_id'          => null,
                    'entry_type'       => 'credit',
                    'amount'           => $net,
                ],
                [
                    'account_type'     => 'user_wallet',
                    'wallet_type'      => 'creator',
                    'balance_category' => 'available',
                    'user_id'          => $escrow->seller_id,
                    'entry_type'       => 'credit',
                    'amount'           => $net,
                ],
                [
                    'account_type'     => 'user_wallet',
                    'wallet_type'      => 'system',
                    'balance_category' => 'escrow',
                    'user_id'          => $escrow->buyer_id,
                    'entry_type'       => 'debit',
                    'amount'           => $gross,
                ],
                [
                    'account_type'     => 'user_wallet',
                    'wallet_type'      => 'system',
                    'balance_category' => 'available',
                    'user_id'          => $escrow->buyer_id,
                    'entry_type'       => 'debit',
                    'amount'           => $fee,
                ],
            ],
            idempotencyKey: 'ESCROW_RELEASE_'.$escrow->id,
            initiatedBy: $releasedBy,
        );

        $escrow->update(['status' => 'released', 'released_at' => now()]);

        return $payout;
    }

    /**
     * Release after a dispute resolves in the seller's favour.
     */
    public function resolveInFavourOfSeller(Escrow $escrow, ?int $resolvedBy = null, ?string $note = null): FulfilmentPayout
    {
        $payout = $this->release($escrow, $resolvedBy, $note);
        if ($escrow->dispute) {
            $escrow->dispute->update([
                'status' => 'resolved', 'resolution' => 'resolved_seller', 'resolved_at' => now(),
            ]);
        }

        return $payout;
    }

    /* ── Refund ────────────────────────────────────────────────────────── */

    /**
     * Refund a held escrow back to the buyer (buyer's obligation reversed in
     * the journal; no wallet movement).
     */
    public function refund(Escrow $escrow, ?int $refundedBy = null, ?string $reason = null, ?int $disputeId = null, ?int $resolvedBy = null): void
    {
        $order = FulfilmentOrder::find($escrow->fulfilment_order_id);

        DB::transaction(function () use ($escrow, $order, $refundedBy, $reason, $disputeId, $resolvedBy) {
            if (! in_array($escrow->status, ['held', 'disputed'], true)) {
                throw new PaymentException(
                    "Escrow #{$escrow->id} cannot be refunded (current: {$escrow->status}).",
                    'ESCROW_NOT_REFUNDABLE',
                    409,
                );
            }

            $this->book(
                escrow: $escrow,
                type: 'escrow_refund',
                description: 'Escrow refunded to buyer'.($reason ? ': '.$reason : ''),
                legs: [
                    [
                        'account_type'     => 'user_wallet',
                        'wallet_type'      => 'system',
                        'balance_category' => 'escrow',
                        'user_id'          => $order?->buyer_id,
                        'entry_type'       => 'debit',
                        'amount'           => $escrow->amount,
                    ],
                    [
                        'account_type'     => 'platform_liability',
                        'wallet_type'      => 'system',
                        'balance_category' => 'escrow',
                        'user_id'          => null,
                        'entry_type'       => 'credit',
                        'amount'           => $escrow->amount,
                    ],
                ],
                idempotencyKey: 'ESCROW_REFUND_'.$escrow->id,
                initiatedBy: $refundedBy,
            );

            $escrow->update(['status' => 'refunded', 'refunded_at' => now()]);
        });
    }

    /**
     * Resolve a dispute in the buyer's favour (refund + mark dispute resolved).
     */
    public function resolveInFavourOfBuyer(Escrow $escrow, ?int $resolvedBy = null, ?string $note = null, ?int $disputeId = null): void
    {
        $this->refund($escrow, $resolvedBy, $note);
        if ($disputeId) {
            $dispute = \App\Models\Dispute::find($disputeId);
            if ($dispute) {
                $dispute->update(['status' => 'resolved', 'resolution' => 'resolved_buyer', 'resolved_at' => now()]);
            }
        }
    }
}
