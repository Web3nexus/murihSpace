<?php

namespace App\Services\Escrow;

use App\Models\Dispute;
use App\Models\Escrow;
use App\Models\FulfilmentOrder;
use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Services\Payment\Exceptions\PaymentException;
use App\Services\Wallet\LedgerService;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * EscrowService — the single source of truth for the escrow lifecycle.
 *
 * Two funding realities are supported by the same service so that the API
 * (EscrowController) and the physical-goods fulfilment flow
 * (FulfilmentOrderController) never diverge:
 *
 *   capture  -> books an `escrow_hold` journal event (buyer obligation vs
 *               platform liability). Paddle is the Merchant of Record and holds
 *               the cash, so no Wallet row is touched at hold time.
 *   release  -> credits the SELLER's creator wallet with the escrow amount and
 *               marks the escrow released.
 *   refund   -> credits the BUYER's system wallet with the escrow amount and
 *               marks the escrow refunded.
 *
 * Release/refund move real Wallet balances through LedgerService (the same
 * wallet the seller sees and the buyer spends from). They deliberately do NOT
 * debit the counterparty: the buyer's funds were collected externally (Paddle),
 * so there is no wallet hold to reverse — debiting would double-charge the
 * buyer (release) or claw back funds the seller never received (refund) and
 * would 500 when the counterparty wallet is short.
 *
 * Payout settlement for physical orders is recorded separately as a
 * FulfilmentPayout; the actual cash transfer runs through the existing payout
 * pipeline (Paddle payouts / bank transfer).
 */
class EscrowService
{
    public function __construct(
        private readonly LedgerService $ledgerService = new LedgerService(),
    ) {}

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
     * Books an escrow_hold journal event idempotently and records captured_at.
     * If the escrow was already created in the held state (the common order
     * flow), only the capture timestamp is recorded — the hold was never
     * booked, so there is nothing to reverse.
     */
    public function capture(Escrow $escrow, ?int $capturedBy = null, ?string $note = null): ?LedgerTransaction
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
        } elseif ($escrow->captured_at === null) {
            // Already held on creation — record the capture time only.
            $escrow->update(['captured_at' => now()]);
        }

        return $escrow->ledgerTransaction;
    }

    /* ── Release ───────────────────────────────────────────────────────── */

    /* ── Wallet movement primitives ────────────────────────────────────── */

    /**
     * Credit the seller's creator wallet with the escrow amount. Idempotent on
     * `ESCROW_RELEASE_{id}` so a release and a seller-favoured dispute can never
     * double-credit.
     */
    private function creditSeller(Escrow $escrow, string $description): LedgerTransaction
    {
        return $this->ledgerService->credit(
            user: $escrow->seller_id,
            amount: (int) $escrow->amount,
            currency: $escrow->currency,
            walletType: 'creator',
            balanceCategory: 'available',
            type: 'escrow_release',
            description: $description,
            idempotencyKey: 'ESCROW_RELEASE_'.$escrow->id,
            metadata: [
                'escrow_id'            => $escrow->id,
                'order_id'             => $escrow->order_id,
                'fulfilment_order_id'  => $escrow->fulfilment_order_id,
            ],
        );
    }

    /**
     * Credit the buyer's system wallet with the escrow amount. Idempotent on
     * `ESCROW_REFUND_{id}`.
     */
    private function creditBuyer(Escrow $escrow, string $description): LedgerTransaction
    {
        return $this->ledgerService->credit(
            user: $escrow->buyer_id,
            amount: (int) $escrow->amount,
            currency: $escrow->currency,
            walletType: 'system',
            balanceCategory: 'available',
            type: 'escrow_refund',
            description: $description,
            idempotencyKey: 'ESCROW_REFUND_'.$escrow->id,
            metadata: [
                'escrow_id'            => $escrow->id,
                'order_id'             => $escrow->order_id,
                'fulfilment_order_id'  => $escrow->fulfilment_order_id,
            ],
        );
    }

    /**
     * Move the escrow's funds to the seller and mark it released. Assumes the
     * caller has already validated that the escrow is in a releasable state.
     */
    private function doRelease(Escrow $escrow, ?string $note = null): void
    {
        $txn = $this->creditSeller(
            $escrow,
            "Escrow release for order #{$escrow->order_id}".($note ? ': '.$note : ''),
        );

        $escrow->update([
            'status'                => 'released',
            'released_at'           => now(),
            'ledger_transaction_id' => $txn->id,
        ]);
    }

    /**
     * Move the escrow's funds to the buyer and mark it refunded. Assumes the
     * caller has already validated that the escrow is in a refundable state.
     */
    private function doRefund(Escrow $escrow, ?string $reason = null): void
    {
        $txn = $this->creditBuyer(
            $escrow,
            'Escrow refund for order #'.$escrow->order_id.($reason ? ': '.$reason : ''),
        );

        $escrow->update([
            'status'                => 'refunded',
            'refunded_at'           => now(),
            'ledger_transaction_id' => $txn->id,
        ]);
    }

    /* ── Release ───────────────────────────────────────────────────────── */

    /**
     * Release a held escrow to the seller: credits the seller's creator wallet
     * with the escrow amount and marks the escrow released. Idempotent.
     */
    public function release(Escrow $escrow, ?int $releasedBy = null, ?string $note = null): void
    {
        if ($escrow->status !== 'held') {
            throw new PaymentException(
                "Escrow #{$escrow->id} cannot be released (current: {$escrow->status}).",
                'ESCROW_NOT_HELD',
                409,
            );
        }

        try {
            DB::transaction(fn () => $this->doRelease($escrow, $note));
        } catch (PaymentException $e) {
            throw $e;
        } catch (\Throwable $e) {
            report($e);
            throw new PaymentException(
                "Escrow #{$escrow->id} could not be released: {$e->getMessage()}",
                'ESCROW_RELEASE_FAILED',
                422,
                previous: $e instanceof \Exception ? $e : null,
            );
        }
    }

    /* ── Refund ────────────────────────────────────────────────────────── */

    /**
     * Refund a held/disputed escrow back to the buyer: credits the buyer's
     * system wallet with the escrow amount and marks the escrow refunded.
     * The seller is NOT debited (funds were never credited on a refund from
     * `held`; clawbacks after release are handled by the payout pipeline).
     */
    public function refund(Escrow $escrow, ?int $refundedBy = null, ?string $reason = null, ?int $disputeId = null, ?int $resolvedBy = null): void
    {
        if (! in_array($escrow->status, ['held', 'disputed'], true)) {
            throw new PaymentException(
                "Escrow #{$escrow->id} cannot be refunded (current: {$escrow->status}).",
                'ESCROW_NOT_REFUNDABLE',
                409,
            );
        }

        try {
            DB::transaction(function () use ($escrow, $reason) {
                // Refunding a disputed escrow settles the open dispute too, so a
                // later admin resolution can never pay the seller as well.
                if ($escrow->status === 'disputed') {
                    $escrow->disputes()
                        ->whereIn('status', ['open', 'under_review'])
                        ->update([
                            'status' => 'resolved_buyer',
                            'resolved_at' => now(),
                        ]);
                }

                $this->doRefund($escrow, $reason);
            });
        } catch (PaymentException $e) {
            throw $e;
        } catch (\Throwable $e) {
            report($e);
            throw new PaymentException(
                "Escrow #{$escrow->id} could not be refunded: {$e->getMessage()}",
                'ESCROW_REFUND_FAILED',
                422,
                previous: $e instanceof \Exception ? $e : null,
            );
        }
    }

    /* ── Disputes ──────────────────────────────────────────────────────── */

    /**
     * Resolve a dispute: records the resolution on the dispute and moves the
     * escrowed funds through the same release/refund primitives used
     * everywhere else, so wallet balances can never diverge by resolution path.
     *
     * - resolved_buyer  -> refund the buyer (escrow refunded)
     * - resolved_seller -> release to the seller (escrow released)
     * - cancelled       -> return the escrow to `held`
     *
     * The escrow row is locked and must still be `disputed`, which (combined
     * with the closing of open disputes on refund) prevents the same funds
     * from being paid out twice by a refund followed by a resolution.
     */
    public function resolveDispute(Dispute $dispute, string $resolution, int $adminId, ?string $note = null): void
    {
        if (! in_array($resolution, ['resolved_buyer', 'resolved_seller', 'cancelled'], true)) {
            throw new PaymentException(
                "Invalid dispute resolution '{$resolution}'.",
                'INVALID_DISPUTE_RESOLUTION',
                422,
            );
        }

        try {
            DB::transaction(function () use ($dispute, $resolution, $adminId, $note) {
                $escrow = Escrow::whereKey($dispute->escrow_id)->lockForUpdate()->firstOrFail();

                if ($escrow->status !== 'disputed') {
                    throw new PaymentException(
                        "Escrow #{$escrow->id} is not disputed (current: {$escrow->status}).",
                        'ESCROW_NOT_DISPUTED',
                        409,
                    );
                }

                $dispute->resolve($resolution, $adminId, $note);

                if ($resolution === 'resolved_buyer') {
                    $this->doRefund($escrow, "Dispute resolved in favour of buyer (dispute #{$dispute->id})");
                } elseif ($resolution === 'resolved_seller') {
                    $this->doRelease($escrow, "Dispute resolved in favour of seller (dispute #{$dispute->id})");
                } else {
                    $escrow->update(['status' => 'held']);
                }
            });
        } catch (PaymentException $e) {
            throw $e;
        } catch (\Throwable $e) {
            report($e);
            throw new PaymentException(
                "Dispute #{$dispute->id} could not be resolved: {$e->getMessage()}",
                'DISPUTE_RESOLVE_FAILED',
                422,
                previous: $e instanceof \Exception ? $e : null,
            );
        }
    }
}
