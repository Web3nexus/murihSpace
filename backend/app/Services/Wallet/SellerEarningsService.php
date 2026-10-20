<?php

namespace App\Services\Wallet;

use App\Models\DigitalSaleSettlement;
use App\Models\Escrow;
use App\Models\KycPendingEarning;
use App\Models\LedgerTransaction;
use App\Models\User;
use App\Models\Wallet;
use App\Notifications\KycEarningsNotification;
use Illuminate\Support\Facades\DB;

/**
 * The one place a seller's earnings are credited.
 *
 *  - Verified seller and review passed: the amount goes to `withdrawable`.
 *  - Otherwise it goes to `pending`. If the reason is KYC, the amount is recorded and
 *    the seller is asked to verify. When KYC is completed, the recorded amounts move
 *    to `withdrawable`, unless an order is on hold or in dispute at that point.
 *
 * Nothing is withdrawable without KYC, whatever the source of the money.
 */
class SellerEarningsService
{
    public function __construct(private readonly LedgerService $ledger) {}

    /**
     * @param bool $reviewPassed False when the review (an open hold or dispute on another order) blocks it.
     */
    public function credit(
        User $seller,
        int $amount,
        string $currency,
        string $type,
        string $description,
        string $idempotencyKey,
        array $metadata = [],
        bool $reviewPassed = true,
    ): LedgerTransaction {
        // A replayed credit must not create a second pending-earning row.
        if ($existing = LedgerTransaction::where('idempotency_key', $idempotencyKey)->first()) {
            return $existing->load('entries');
        }

        $verified = $seller->hasVerifiedKyc();
        $category = ($verified && $reviewPassed) ? 'withdrawable' : 'pending';

        // The part of this credit that repays debt does not reach the seller.
        $debt = (int) Wallet::where('user_id', $seller->id)->where('wallet_type', 'creator')->value('debt');
        $netForSeller = $amount - min($debt, $amount);

        $held = $category === 'pending';
        $awaitingKyc = ! $verified;
        $hadHeld = $held && KycPendingEarning::where('user_id', $seller->id)->whereNull('swept_at')->exists();

        $txn = $this->ledger->creditEarnings(
            user: $seller,
            amount: $amount,
            currency: $currency,
            walletType: 'creator',
            balanceCategory: $category,
            type: $type,
            description: $description,
            idempotencyKey: $idempotencyKey,
            metadata: array_merge($metadata, ['awaiting_kyc' => $awaitingKyc]),
        );

        // Every amount that lands in pending is recorded, so it can be released later.
        if ($held && $netForSeller > 0) {
            KycPendingEarning::create([
                'user_id' => $seller->id,
                'ledger_transaction_id' => $txn->id,
                'amount' => $netForSeller,
                'currency' => $currency,
                'source' => $type,
                'reason' => $awaitingKyc ? 'kyc' : 'review',
            ]);

            if ($awaitingKyc && ! $hadHeld) {
                DB::afterCommit(fn () => $seller->notify(new KycEarningsNotification($this->startVerification($seller))));
            }
        }

        return $txn;
    }

    /**
     * Starts an identity verification session for the seller, so the notice carries a live link.
     * Returns null when the provider is not configured, and the in-app page is used instead.
     */
    private function startVerification(User $seller): ?string
    {
        try {
            $result = app(\App\Services\Kyc\KycService::class)->startSession($seller);
            $session = $result['session'] ?? null;

            return ($session && $session->success) ? $session->sessionUrl : null;
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }

    /**
     * Holds a digital sale in `pending` for the 48-hour window. Debt is repaid first.
     *
     * @return array{txn: LedgerTransaction, credited: int} `credited` is what reached the seller, in USD cents.
     */
    public function holdPending(User $seller, int $usdCents, string $type, string $idempotencyKey, array $metadata = []): array
    {
        $debt = (int) Wallet::where('user_id', $seller->id)->where('wallet_type', 'creator')->value('debt');

        $txn = $this->ledger->creditEarnings(
            user: $seller,
            amount: $usdCents,
            currency: 'USD',
            walletType: 'creator',
            balanceCategory: 'pending',
            type: $type,
            description: 'Sale held for 48 hours',
            idempotencyKey: $idempotencyKey,
            metadata: $metadata,
        );

        return ['txn' => $txn, 'credited' => $usdCents - min($debt, $usdCents)];
    }

    /**
     * Releases a held sale once its window closes. A verified seller gets it in `withdrawable`.
     * Otherwise it is recorded as awaiting KYC and stays in `pending` until verification.
     */
    public function releaseHeld(User $seller, int $credited, string $type, string $idempotencyKey): void
    {
        if ($credited <= 0) {
            return;
        }

        if (! $seller->hasVerifiedKyc()) {
            $hadHeld = KycPendingEarning::where('user_id', $seller->id)->whereNull('swept_at')->exists();
            KycPendingEarning::create([
                'user_id' => $seller->id,
                'amount' => $credited,
                'currency' => 'USD',
                'source' => $type,
                'reason' => 'kyc',
            ]);
            if (! $hadHeld) {
                DB::afterCommit(fn () => $seller->notify(new KycEarningsNotification($this->startVerification($seller))));
            }

            return;
        }

        // Another order of the seller is on hold or in dispute: the release waits for review.
        if ($this->blocked($seller)) {
            KycPendingEarning::create([
                'user_id' => $seller->id,
                'amount' => $credited,
                'currency' => 'USD',
                'source' => $type,
                'reason' => 'review',
            ]);

            return;
        }

        $this->ledger->debit(
            user: $seller,
            amount: $credited,
            currency: 'USD',
            walletType: 'creator',
            balanceCategory: 'pending',
            type: 'digital_release',
            description: 'Sale released after the 48-hour window',
            idempotencyKey: $idempotencyKey.'_D',
        );
        $this->ledger->credit(
            user: $seller,
            amount: $credited,
            currency: 'USD',
            walletType: 'creator',
            balanceCategory: 'withdrawable',
            type: 'digital_release',
            description: 'Sale released after the 48-hour window',
            idempotencyKey: $idempotencyKey.'_C',
        );
    }

    /** True while any of the seller's escrows or digital sales is on hold or in dispute. */
    public function blocked(User $seller): bool
    {
        return Escrow::where('seller_id', $seller->id)->whereIn('status', ['on_hold', 'disputed'])->exists()
            || DigitalSaleSettlement::where('seller_id', $seller->id)->where('status', 'disputed')->exists();
    }

    /** Moves up to $usdCents from the seller's withdrawable balance into `disputed`. Returns the amount held. */
    public function holdFromWithdrawable(User $seller, int $usdCents, string $idempotencyKey): int
    {
        $wallet = Wallet::where('user_id', $seller->id)->where('wallet_type', 'creator')->lockForUpdate()->first();
        $take = min((int) ($wallet?->withdrawable ?? 0), $usdCents);
        if ($take <= 0) {
            return 0;
        }

        $this->ledger->debit(user: $seller, amount: $take, currency: 'USD', walletType: 'creator', balanceCategory: 'withdrawable', type: 'dispute_hold', description: 'Held for an open dispute', idempotencyKey: $idempotencyKey.'_HOLD_D');
        $this->ledger->credit(user: $seller, amount: $take, currency: 'USD', walletType: 'creator', balanceCategory: 'disputed', type: 'dispute_hold', description: 'Held for an open dispute', idempotencyKey: $idempotencyKey.'_HOLD_C');

        return $take;
    }

    /** The dispute was won by the seller: the held amount goes back to withdrawable. */
    public function returnFromDisputed(User $seller, int $usdCents, string $idempotencyKey): void
    {
        if ($usdCents <= 0) {
            return;
        }
        $this->ledger->debit(user: $seller, amount: $usdCents, currency: 'USD', walletType: 'creator', balanceCategory: 'disputed', type: 'dispute_release', description: 'Dispute won: funds returned', idempotencyKey: $idempotencyKey.'_RET_D');
        $this->ledger->credit(user: $seller, amount: $usdCents, currency: 'USD', walletType: 'creator', balanceCategory: 'withdrawable', type: 'dispute_release', description: 'Dispute won: funds returned', idempotencyKey: $idempotencyKey.'_RET_C');
    }

    /**
     * The dispute was lost by the seller. The held amount is clawed back. Any part not covered
     * by the held amount is taken from the withdrawable balance, and what is still owed becomes debt.
     */
    public function clawback(User $seller, int $heldUsd, int $owedUsd, string $idempotencyKey): void
    {
        if ($heldUsd > 0) {
            $this->ledger->debit(user: $seller, amount: $heldUsd, currency: 'USD', walletType: 'creator', balanceCategory: 'disputed', type: 'clawback', description: 'Chargeback or refund clawed back', idempotencyKey: $idempotencyKey.'_CLAW_HELD');
        }
        if ($owedUsd > 0) {
            $this->ledger->debitAllowingDebt(user: $seller, amount: $owedUsd, currency: 'USD', walletType: 'creator', balanceCategory: 'withdrawable', type: 'clawback', description: 'Chargeback or refund clawed back', idempotencyKey: $idempotencyKey.'_CLAW_OWED');
        }
    }

    /** A dispute on a sale still in its window: the pending amount is taken out. */
    public function reversePending(User $seller, int $usdCents, string $idempotencyKey): void
    {
        if ($usdCents <= 0) {
            return;
        }
        $this->ledger->debit(user: $seller, amount: $usdCents, currency: 'USD', walletType: 'creator', balanceCategory: 'pending', type: 'clawback', description: 'Sale reversed after a dispute', idempotencyKey: $idempotencyKey.'_REV');
    }

    /**
     * Moves the recorded KYC-held amounts from `pending` to `withdrawable`. Runs when the
     * seller becomes verified. Amounts are left in place while an order is on hold or in dispute.
     */
    public function sweepAwaitingKyc(User $seller): int
    {
        if (! $seller->hasVerifiedKyc()) {
            return 0;
        }

        if ($this->blocked($seller)) {
            return 0;
        }

        $moved = 0;

        KycPendingEarning::where('user_id', $seller->id)
            ->whereNull('swept_at')
            ->orderBy('id')
            ->chunkById(50, function ($rows) use (&$moved) {
                foreach ($rows as $row) {
                    DB::transaction(function () use ($row, &$moved) {
                        $locked = KycPendingEarning::whereKey($row->id)->lockForUpdate()->first();
                        if (! $locked || $locked->swept_at) {
                            return;
                        }

                        $this->ledger->debit(
                            user: $locked->user_id,
                            amount: $locked->amount,
                            currency: $locked->currency,
                            walletType: 'creator',
                            balanceCategory: 'pending',
                            type: 'kyc_release',
                            description: 'Earnings released after identity verification',
                            idempotencyKey: "KYC_SWEEP_{$locked->id}_D",
                        );
                        $this->ledger->credit(
                            user: $locked->user_id,
                            amount: $locked->amount,
                            currency: $locked->currency,
                            walletType: 'creator',
                            balanceCategory: 'withdrawable',
                            type: 'kyc_release',
                            description: 'Earnings released after identity verification',
                            idempotencyKey: "KYC_SWEEP_{$locked->id}_C",
                        );

                        $locked->update(['swept_at' => now()]);
                        $moved += (int) $locked->amount;
                    });
                }
            });

        return $moved;
    }
}
