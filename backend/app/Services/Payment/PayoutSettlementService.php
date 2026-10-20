<?php

namespace App\Services\Payment;

use App\Enums\PayoutStatus;
use App\Models\AuditLog;
use App\Models\Payout;
use App\Models\PayoutDestination;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Services\AdminAlertService;
use App\Services\NotificationService;
use App\Services\Payment\Contracts\PayoutProviderInterface;
use App\Services\Payment\DTO\PayoutRequest;
use App\Services\Payment\Exceptions\PaymentException;
use App\Services\Payment\Router\ProviderRouter;
use App\Services\Wallet\LedgerService;
use App\Services\Wallet\WalletService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The only place a provider payout moves a withdrawal's money.
 *
 * Money rules:
 *  - Requesting a withdrawal already moved the funds into `reserved`.
 *  - Sending a transfer does not move money. The provider's confirmation does:
 *      successful -> debit `reserved` once (the withdrawal is paid)
 *      failed     -> release `reserved` back to `withdrawable` once
 *  - A provider response that is only "processing", an exception, or a rejection is not a
 *    confirmation. It never completes or releases a withdrawal.
 *  - Ledger keys are fixed per withdrawal (WDR-{id}, WDR-{id}_RELEASE), so a replayed outcome
 *    cannot move the same money twice even if the status check below were bypassed.
 */
class PayoutSettlementService
{
    public function __construct(
        private readonly ProviderRouter $router,
        private readonly LedgerService $ledger,
        private readonly WalletService $wallets,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Admin approval. Creates the provider transfer and waits for the provider to confirm it.
     */
    public function dispatch(WithdrawalRequest $withdrawal, int $actorId): Payout
    {
        [$payout, $destination, $provider] = DB::transaction(function () use ($withdrawal, $actorId) {
            $locked = WithdrawalRequest::whereKey($withdrawal->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== 'pending') {
                throw new PaymentException('Withdrawal already processed.', 'ALREADY_PROCESSED', 409);
            }

            $user = User::findOrFail($locked->user_id);
            if (! $user->hasVerifiedKyc()) {
                throw new PaymentException(
                    'The account holder must complete identity verification (KYC) before a withdrawal is approved.',
                    'KYC_REQUIRED',
                    422,
                );
            }

            $destination = PayoutDestination::where('user_id', $user->id)
                ->orderByDesc('is_default')
                ->orderByDesc('id')
                ->first();
            if (! $destination) {
                throw new PaymentException('The account holder has no payout destination on file.', 'NO_PAYOUT_DESTINATION', 422);
            }

            $currency = strtoupper($locked->currency ?: 'USD');
            try {
                $provider = $this->router->resolve(
                    transactionType: 'payout',
                    currency: $currency,
                    country: $destination->country_code,
                    paymentMethod: $destination->destination_type,
                    amount: $locked->amount,
                );
            } catch (Throwable $e) {
                throw new PaymentException('No payout provider is available for this destination.', 'NO_PAYOUT_PROVIDER', 422);
            }
            if (! ($provider instanceof PayoutProviderInterface)) {
                throw new PaymentException('No payout provider is available for this destination.', 'NO_PAYOUT_PROVIDER', 422);
            }

            // One payout row per withdrawal (unique index). Its reference is the provider's idempotency key.
            $payout = Payout::create([
                'user_id' => $user->id,
                'withdrawal_request_id' => $locked->id,
                'payout_destination_id' => $destination->id,
                'amount' => $locked->amount,
                'currency' => $currency,
                'net_amount' => $locked->amount,
                'provider' => $provider->providerCode(),
                'status' => PayoutStatus::Pending,
                'idempotency_key' => "WDR-{$locked->id}-PAYOUT",
            ]);

            $locked->update([
                'status' => 'processing',
                'processed_by' => $actorId,
                'processed_at' => now(),
            ]);

            $this->audit('withdrawal.approved', $actorId, $locked, ['payout_id' => $payout->id, 'provider' => $payout->provider]);

            return [$payout, $destination, $provider];
        });

        $this->send($payout, $withdrawal->fresh(), $destination, $provider, $actorId, 'dispatch');

        return $payout->fresh();
    }

    /**
     * Admin recovery. Re-sends a transfer the provider did not accept. Providers de-duplicate on the
     * reference, so a re-send cannot create a second transfer. Never touches the ledger.
     */
    public function retry(WithdrawalRequest $withdrawal, int $actorId): Payout
    {
        [$payout, $destination, $provider] = DB::transaction(function () use ($withdrawal, $actorId) {
            $locked = WithdrawalRequest::whereKey($withdrawal->id)->lockForUpdate()->firstOrFail();
            $payout = Payout::where('withdrawal_request_id', $locked->id)->lockForUpdate()->first();

            $notAccepted = $payout && $payout->provider_payout_id === null;
            $allowed = $locked->status === 'dispatch_failed'
                || ($locked->status === 'processing' && $notAccepted && $payout->dispatch_error !== null);

            if (! $allowed || ! $payout) {
                throw new PaymentException(
                    'Only a transfer the provider did not accept can be retried.',
                    'RETRY_NOT_ALLOWED',
                    409,
                );
            }

            $destination = PayoutDestination::find($payout->payout_destination_id);
            if (! $destination) {
                throw new PaymentException('The payout destination for this withdrawal no longer exists.', 'NO_PAYOUT_DESTINATION', 422);
            }

            $provider = $this->router->getProvider($payout->provider);
            if (! ($provider instanceof PayoutProviderInterface)) {
                throw new PaymentException('The payout provider does not support transfers.', 'NO_PAYOUT_PROVIDER', 422);
            }

            $payout->update(['status' => PayoutStatus::Pending, 'failure_reason' => null]);
            $locked->update(['status' => 'processing']);
            $this->audit('payout.retry_dispatch', $actorId, $locked, ['payout_id' => $payout->id]);

            return [$payout, $destination, $provider];
        });

        $this->send($payout, $withdrawal->fresh(), $destination, $provider, $actorId, 'retry');

        return $payout->fresh();
    }

    /**
     * Applies a provider's result for a transfer (webhook). Duplicate and out-of-order results are
     * ignored by the status checks, and the ledger keys stop any second movement of money.
     *
     * @param  array{provider: string, event_type: string, outcome: string, reference: string, provider_ids: array<int, string>, raw: array}  $event
     */
    public function applyWebhookOutcome(array $event): void
    {
        $payout = Payout::where('provider', $event['provider'])
            ->whereNotNull('withdrawal_request_id')
            ->where(function ($q) use ($event) {
                $q->where('public_reference', $event['reference']);
                if ($event['provider_ids'] !== []) {
                    $q->orWhereIn('provider_payout_id', $event['provider_ids']);
                }
            })
            ->first();

        if (! $payout) {
            Log::warning('Payout webhook matched no withdrawal transfer', ['provider' => $event['provider'], 'event' => $event['event_type']]);

            return;
        }

        $this->applyOutcome($payout, $event['outcome'], 'webhook:'.$event['event_type'], $event['raw']);
    }

    private function send(Payout $payout, WithdrawalRequest $withdrawal, PayoutDestination $destination, PayoutProviderInterface $provider, int $actorId, string $mode): void
    {
        $payout->increment('dispatch_attempts');

        $details = $destination->details_encrypted ?? [];
        // The masked number is only a fallback. A full number stored on the destination wins.
        $details += [
            'account_number' => $destination->account_number_masked,
            'account_name' => $destination->account_name,
            'bank_code' => $destination->bank_code,
        ];

        $request = new PayoutRequest(
            internalReference: $payout->internal_reference,
            publicReference: $payout->public_reference,
            amount: $withdrawal->amount,
            currency: $payout->currency,
            destinationType: $destination->destination_type,
            destinationDetails: $details,
            idempotencyKey: $payout->idempotency_key,
            narration: 'MurihSpace Creator Earnings Payout',
        );

        try {
            $response = $provider->initiatePayout($request);
        } catch (Throwable $e) {
            // Unknown outcome: the provider may have accepted the transfer before the failure.
            // The withdrawal stays processing, and only a provider result can move it on.
            $payout->update(['dispatch_error' => $e->getMessage()]);
            $this->audit('payout.dispatch_error', $actorId, $withdrawal, ['payout_id' => $payout->id, 'mode' => $mode, 'error' => $e->getMessage()]);
            Log::error('Payout dispatch error; awaiting provider result', ['payout_id' => $payout->id, 'error' => $e->getMessage()]);

            return;
        }

        $update = [
            'provider_payout_id' => $response->providerPayoutId !== '' ? $response->providerPayoutId : null,
            'provider_reference' => $response->providerReference,
            'fee_amount' => $response->feeAmount,
            'dispatched_at' => now(),
            'dispatch_error' => null,
        ];
        // Success and failure set their own status when they settle; only "processing" is recorded here.
        if ($response->status === PayoutStatus::Processing) {
            $update['status'] = PayoutStatus::Processing;
        }
        $payout->update($update);

        match ($response->status) {
            PayoutStatus::Successful => $this->applyOutcome($payout->fresh(), 'successful', 'provider_response', $response->rawResponse),
            PayoutStatus::Failed => $this->markDispatchFailed($payout->fresh(), $response->failureReason, $actorId, $mode),
            default => $this->audit('payout.dispatched', $actorId, $withdrawal, ['payout_id' => $payout->id, 'mode' => $mode, 'provider_payout_id' => $payout->provider_payout_id]),
        };
    }

    /** The provider rejected the transfer outright. Funds stay reserved until a retry or a provider failure. */
    private function markDispatchFailed(Payout $payout, ?string $reason, int $actorId, string $mode): void
    {
        DB::transaction(function () use ($payout, $reason, $actorId, $mode) {
            $withdrawal = WithdrawalRequest::whereKey($payout->withdrawal_request_id)->lockForUpdate()->firstOrFail();
            $payout = Payout::whereKey($payout->id)->lockForUpdate()->firstOrFail();

            if ($payout->status === PayoutStatus::Successful || $payout->status === PayoutStatus::Failed) {
                return; // a provider result already settled this transfer
            }

            $payout->update(['status' => PayoutStatus::Failed, 'failure_reason' => $reason]);
            if ($withdrawal->status === 'processing') {
                $withdrawal->update(['status' => 'dispatch_failed']);
            }
            $this->audit('payout.dispatch_failed', $actorId, $withdrawal, ['payout_id' => $payout->id, 'mode' => $mode, 'reason' => $reason]);
        });
    }

    /**
     * Settles a transfer from a provider-confirmed outcome. Only processing, dispatch_failed
     * withdrawals can move, so a repeated or contradicting result cannot pay or refund twice.
     */
    private function applyOutcome(Payout $payout, string $outcome, string $source, array $raw): void
    {
        $settled = DB::transaction(function () use ($payout, $outcome, $source, $raw) {
            $payout = Payout::whereKey($payout->id)->lockForUpdate()->firstOrFail();
            $withdrawal = WithdrawalRequest::whereKey($payout->withdrawal_request_id)->lockForUpdate()->firstOrFail();
            $user = User::findOrFail($withdrawal->user_id);
            $walletType = $withdrawal->wallet_type ?? 'creator';
            $wallet = $this->wallets->getOrCreateWallet($user, $walletType);
            $open = in_array($withdrawal->status, ['processing', 'dispatch_failed'], true);

            if ($outcome === 'successful') {
                if ($open) {
                    if ((int) $wallet->reserved < $withdrawal->amount) {
                        throw new PaymentException('Reserved funds for this withdrawal are missing; the transfer needs manual review.', 'RESERVE_MISSING', 500);
                    }

                    $ledgerTxn = $this->ledger->debit(
                        user: $user,
                        amount: $withdrawal->amount,
                        currency: $wallet->currency,
                        walletType: $walletType,
                        balanceCategory: 'reserved',
                        type: 'withdrawal',
                        description: "Withdrawal request #{$withdrawal->id}",
                        idempotencyKey: "WDR-{$withdrawal->id}",
                        metadata: ['payout_id' => $payout->id, 'provider' => $payout->provider],
                    );

                    $payout->update(['status' => PayoutStatus::Successful, 'completed_at' => now(), 'failure_reason' => null]);
                    $withdrawal->update(['status' => 'completed', 'ledger_transaction_id' => $ledgerTxn->id]);
                    $this->audit('payout.completed', null, $withdrawal, ['payout_id' => $payout->id, 'source' => $source, 'provider_payout_id' => $payout->provider_payout_id]);
                    $this->emailOutcome($user, $withdrawal, 'completed');

                    return 'completed';
                }

                if ($withdrawal->status === 'completed') {
                    return 'duplicate';
                }

                $this->conflict($withdrawal, $payout, $source, 'Provider confirmed a transfer for a withdrawal that is already '.$withdrawal->status.'.');

                return 'conflict';
            }

            // Failure outcome
            if ($open) {
                if ((int) $wallet->reserved < $withdrawal->amount) {
                    throw new PaymentException('Reserved funds for this withdrawal are missing; the failure needs manual review.', 'RESERVE_MISSING', 500);
                }

                $this->ledger->debit(
                    user: $user,
                    amount: $withdrawal->amount,
                    currency: $wallet->currency,
                    walletType: $walletType,
                    balanceCategory: 'reserved',
                    type: 'withdrawal_release',
                    description: "Releasing frozen funds for failed withdrawal request #{$withdrawal->id}",
                    idempotencyKey: "WDR-{$withdrawal->id}_RELEASE",
                    metadata: ['withdrawal_id' => $withdrawal->id, 'payout_id' => $payout->id],
                );
                $this->ledger->credit(
                    user: $user,
                    amount: $withdrawal->amount,
                    currency: $wallet->currency,
                    walletType: $walletType,
                    balanceCategory: 'withdrawable',
                    type: 'withdrawal_release',
                    description: "Releasing frozen funds for failed withdrawal request #{$withdrawal->id}",
                    idempotencyKey: "WDR-{$withdrawal->id}_RELEASE_CREDIT",
                    metadata: ['withdrawal_id' => $withdrawal->id, 'payout_id' => $payout->id],
                );

                $payout->update(['status' => PayoutStatus::Failed, 'failure_reason' => $raw['message'] ?? $source]);
                $withdrawal->update(['status' => 'failed']);
                $this->audit('payout.failed', null, $withdrawal, ['payout_id' => $payout->id, 'source' => $source, 'provider_payout_id' => $payout->provider_payout_id]);
                $this->emailOutcome($user, $withdrawal, 'failed');

                return 'failed';
            }

            if ($withdrawal->status === 'completed') {
                // The provider reversed a transfer that was already paid. Money is not moved
                // automatically here, because that would be a second decision on settled funds.
                $payout->update(['status' => PayoutStatus::Reversed]);
                $this->conflict($withdrawal, $payout, $source, 'Provider reversed a completed transfer. Review and decide the recovery.');

                return 'reversed';
            }

            return $withdrawal->status === 'failed' ? 'duplicate' : 'conflict';
        });

        if ($settled === 'conflict') {
            Log::critical('Payout settlement conflict', ['payout_id' => $payout->id, 'source' => $source]);
        }
    }

    private function conflict(WithdrawalRequest $withdrawal, Payout $payout, string $source, string $message): void
    {
        $this->audit('payout.conflict', null, $withdrawal, ['payout_id' => $payout->id, 'source' => $source, 'message' => $message]);

        try {
            app(AdminAlertService::class)->dispatch([
                'event_type' => 'payout_settlement_conflict',
                'severity' => 'critical',
                'title' => "Payout conflict on withdrawal #{$withdrawal->id}",
                'description' => $message.' Money was not moved automatically.',
                'reference' => "withdrawal:{$withdrawal->id}",
                'affected_service' => 'payouts',
                'metadata' => ['withdrawal_id' => $withdrawal->id, 'payout_id' => $payout->id, 'source' => $source],
            ]);
        } catch (Throwable $e) {
            report($e);
        }
    }

    private function audit(string $action, ?int $actorId, WithdrawalRequest $withdrawal, array $metadata = []): void
    {
        AuditLog::create([
            'user_id' => $actorId,
            'action' => $action,
            'resource_type' => 'withdrawal_request',
            'resource_id' => (string) $withdrawal->id,
            'metadata' => $metadata,
        ]);
    }

    private function emailOutcome(User $user, WithdrawalRequest $withdrawal, string $outcome): void
    {
        try {
            $amount = number_format($withdrawal->amount / 100.0, 2);
            $currency = e($withdrawal->currency);
            if ($outcome === 'completed') {
                $title = 'Your withdrawal has been paid';
                $body = "<p>Your withdrawal of <strong>{$currency} {$amount}</strong> was confirmed by our payment provider and is on its way to your account.</p>";
                $template = 'withdrawal_approved';
            } else {
                $title = 'Your withdrawal could not be sent';
                $body = "<p>Your withdrawal of <strong>{$currency} {$amount}</strong> could not be sent by our payment provider. The funds have been returned to your withdrawable balance.</p>";
                $template = 'withdrawal_failed';
            }

            $this->notifications->actionEmail(
                user: $user,
                title: $title,
                bodyHtml: $body,
                actionLabel: 'View wallet',
                actionUrl: NotificationService::link('wallet'),
                template: $template,
                data: ['currency' => $currency, 'amount' => $amount],
            );
        } catch (Throwable $e) {
            report($e);
        }
    }
}
