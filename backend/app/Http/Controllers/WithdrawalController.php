<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Services\NotificationService;
use App\Services\Payment\Exceptions\PaymentException;
use App\Services\Payment\PayoutSettlementService;
use App\Services\Wallet\LedgerService;
use App\Services\Wallet\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WithdrawalController extends Controller
{
    public function __construct(
        private LedgerService $ledgerService,
        private WalletService $walletService,
        private NotificationService $notifications,
    ) {}

    public function request(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasVerifiedKyc()) {
            return response()->json([
                'message' => 'Complete KYC identity verification before withdrawing. Even funds you deposited must be verified before withdrawal.',
                'code' => 'KYC_REQUIRED',
            ], 403);
        }

        $validated = $request->validate([
            'wallet_type' => ['nullable', 'string', 'in:system,creator,business'],
            'amount' => ['required', 'integer', 'min:100'],
            'currency' => ['nullable', 'string', 'max:3'],
            'pin' => ['required', 'string', 'digits:4'],
        ]);

        $walletType = $validated['wallet_type'] ?? 'creator';

        if ($walletType === 'system' && ! $user->isSuperAdmin()) {
            return response()->json([
                'message' => 'System wallet funds cannot be withdrawn directly. Creator and business earnings can be withdrawn from their respective wallets.',
                'code' => 'SYSTEM_WALLET_WITHDRAWAL_RESTRICTED',
            ], 403);
        }

        $walletService = $this->walletService;
        $wallet = $walletService->getOrCreateWallet($user, $walletType);

        // Withdrawals stay locked while the wallet owes money or the seller has funds on hold
        // or in dispute. The money is released only when those are cleared.
        if ((int) $wallet->debt > 0) {
            return response()->json([
                'message' => 'Withdrawals are locked until your negative balance is cleared. Future earnings repay it automatically.',
                'code' => 'NEGATIVE_BALANCE',
                'debt' => (int) $wallet->debt,
            ], 403);
        }
        if (\App\Models\Escrow::where('seller_id', $user->id)->whereIn('status', ['on_hold', 'disputed'])->exists()
            || \App\Models\DigitalSaleSettlement::where('seller_id', $user->id)->where('status', 'disputed')->exists()) {
            return response()->json([
                'message' => 'Withdrawals are locked while an order you sold is on hold or in dispute.',
                'code' => 'FUNDS_ON_HOLD',
            ], 403);
        }

        if (! $wallet->verifyPin($validated['pin'])) {
            return response()->json(['message' => 'Incorrect transaction PIN.', 'code' => 'INVALID_TRANSACTION_PIN'], 403);
        }

        // `withdrawable` is the authoritative column for withdrawal eligibility.
        // A zero withdrawable balance means no funds are eligible — do not fall back to `available`.
        if ($wallet->withdrawable < $validated['amount']) {
            return response()->json(['message' => 'Insufficient withdrawable balance.', 'code' => 'INSUFFICIENT_BALANCE'], 422);
        }

        $destCurrency = strtoupper($validated['currency'] ?? 'USD');
        $rateService = app(\App\Services\Payment\LiveExchangeRateService::class);
        $rate = $rateService->payoutRate('USD', $destCurrency);
        $estimatedLocal = round(($validated['amount'] / 100.0) * $rate, 2);

        $withdrawal = \Illuminate\Support\Facades\DB::transaction(function () use ($user, $wallet, $walletType, $validated, $destCurrency) {
            $withdrawal = WithdrawalRequest::create([
                'user_id'     => $user->id,
                'amount'      => $validated['amount'], // in USD cents
                'currency'    => $destCurrency,
                'wallet_type' => $walletType,
                'status'      => 'pending',
            ]);

            // Reserve the requested funds immediately so they cannot be spent
            // (gifted, used for commerce, etc.) while the request is pending.
            // `withdrawable` is the physical eligibility bucket; `reserved`
            // is the frozen bucket. Reserve = withdrawable -> reserved.
            $this->ledgerService->debit(
                user: $user,
                amount: $withdrawal->amount,
                currency: $wallet->currency,
                walletType: $walletType,
                balanceCategory: 'withdrawable',
                type: 'withdrawal_reserve',
                description: "Reserving funds for withdrawal request #{$withdrawal->id}",
                idempotencyKey: "WDR-{$withdrawal->id}_RESERVE",
                metadata: ['withdrawal_id' => $withdrawal->id],
            );

            $this->ledgerService->credit(
                user: $user,
                amount: $withdrawal->amount,
                currency: $wallet->currency,
                walletType: $walletType,
                balanceCategory: 'reserved',
                type: 'withdrawal_reserve',
                description: "Reserving funds for withdrawal request #{$withdrawal->id}",
                idempotencyKey: "WDR-{$withdrawal->id}_RESERVE_CREDIT",
                metadata: ['withdrawal_id' => $withdrawal->id],
            );

            return $withdrawal;
        });

        try {
            app(\App\Services\AdminNotificationService::class)->dispatch([
                'category' => \App\Enums\AdminNotificationCategory::WithdrawalRequest->value,
                'severity' => 'warning',
                'title' => 'New Withdrawal Request',
                // `amount` is USD cents. Labelling it with the destination code
                // told the approving operator that a USD 50.00 request was
                // "NGN 50.00", on the screen where that mistake is expensive.
                'message' => "User {$user->name} requested a withdrawal of USD "
                    . number_format($validated['amount'] / 100.0, 2)
                    . " (payout in {$destCurrency}).",
                'action_url' => '/securegate/payouts',
                'reference_id' => (string) $withdrawal->id,
                'reference_type' => 'withdrawal_request',
                'metadata' => [
                    'withdrawal_id' => $withdrawal->id,
                    'user_id' => $user->id,
                    'amount' => $validated['amount'],
                    'currency' => $destCurrency,
                ],
            ]);
        } catch (\Throwable $e) {
            // Non-blocking
        }

        return response()->json([
            'message' => 'Withdrawal request submitted for review.',
            'data' => array_merge($withdrawal->toArray(), [
                'amount_usd' => $validated['amount'] / 100.0,
                'exchange_rate' => $rate,
                'estimated_payout_amount' => $estimatedLocal,
                'estimated_payout_formatted' => $rateService->format($estimatedLocal, $destCurrency),
            ]),
        ], 201);
    }

    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount'               => ['required', 'integer', 'min:100'], // in USD cents
            'destination_currency' => ['nullable', 'string', 'size:3'],
            'wallet_type'          => ['nullable', 'string', 'in:system,creator,business'],
        ]);

        $user = $request->user();
        $targetCurrency = strtoupper($validated['destination_currency'] ?? 'USD');
        $amountUsdCents = (int) $validated['amount'];
        $amountUsd = $amountUsdCents / 100.0;

        $feeUsd = max(1.0, round($amountUsd * 0.015, 2));
        $netUsd = max(0.0, $amountUsd - $feeUsd);

        $rateService = app(\App\Services\Payment\LiveExchangeRateService::class);
        $rate = $rateService->payoutRate('USD', $targetCurrency);
        $estimatedLocalPayout = round($netUsd * $rate, 2);

        $wallet = $this->walletService->getOrCreateWallet($user, $validated['wallet_type'] ?? 'creator');

        return response()->json([
            'success'                    => true,
            'amount_usd_cents'           => $amountUsdCents,
            'amount_usd'                 => $amountUsd,
            'fee_usd'                    => $feeUsd,
            'net_usd'                    => $netUsd,
            'wallet_withdrawable_usd'    => $wallet->withdrawable / 100.0,
            'has_sufficient_balance'     => $wallet->withdrawable >= $amountUsdCents,
            'rate'                       => $rate,
            'destination_currency'       => $targetCurrency,
            'estimated_payout_amount'    => $estimatedLocalPayout,
            'estimated_payout_formatted' => $rateService->format($estimatedLocalPayout, $targetCurrency),
            'quote_expires_in_seconds'   => 900,
        ]);
    }

    public function myRequests(Request $request): JsonResponse
    {
        $requests = WithdrawalRequest::where('user_id', $request->user()->id)
            ->latest()
            ->paginate(20);

        return response()->json($requests);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $query = WithdrawalRequest::with(['user:id,name,username']);

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('id', (int) $search)
                    ->orWhere('ledger_transaction_id', (int) $search)
                    ->orWhere('user_id', (int) $search);
                if (in_array(strtolower($search), ['pending', 'approved', 'processing', 'completed', 'rejected'], true)) {
                    $q->orWhere('status', strtolower($search));
                }
            });
        }

        $requests = $query->latest()->paginate(20);

        return response()->json($requests);
    }

    public function adminProcess(Request $request, int $id): JsonResponse
    {
        if (! $request->user()->hasAdminPermission('payouts')) {
            return response()->json([
                'message' => 'Forbidden. Financial auditors and accountants cannot process or approve withdrawals.',
            ], 403);
        }

        $validated = $request->validate([
            'action' => ['required', 'string', 'in:approve,reject'],
            'rejection_reason' => ['required_if:action,reject', 'nullable', 'string', 'max:1000'],
        ]);

        if ($validated['action'] === 'approve') {
            return $this->approve($id, $request);
        }

        return \Illuminate\Support\Facades\DB::transaction(function () use ($id, $validated, $request) {
            $withdrawal = WithdrawalRequest::where('id', $id)->lockForUpdate()->firstOrFail();

            if ($withdrawal->status !== 'pending') {
                return response()->json(['message' => 'Withdrawal already processed.', 'code' => 'ALREADY_PROCESSED'], 409);
            }

            if ($validated['action'] === 'reject') {
                $user = User::find($withdrawal->user_id);
                if (! $user) {
                    return response()->json(['message' => 'Withdrawal owner not found.', 'code' => 'USER_NOT_FOUND'], 404);
                }

                $withdrawal->update([
                    'status' => 'rejected',
                    'rejection_reason' => $validated['rejection_reason'],
                    'processed_by' => $request->user()->id,
                    'processed_at' => now(),
                ]);

                AuditLog::create([
                    'user_id' => $request->user()->id,
                    'action' => 'withdrawal.rejected',
                    'resource_type' => 'withdrawal_request',
                    'resource_id' => (string) $withdrawal->id,
                    'metadata' => ['reason' => $validated['rejection_reason']],
                ]);

                // Return the reserved funds to the user's withdrawable balance.
                $walletType = $withdrawal->wallet_type ?? 'creator';
                $wallet = $this->walletService->getOrCreateWallet($user, $walletType);
                if ((int) $wallet->reserved >= $withdrawal->amount) {
                    $this->ledgerService->debit(
                        user: $user,
                        amount: $withdrawal->amount,
                        currency: $wallet->currency,
                        walletType: $walletType,
                        balanceCategory: 'reserved',
                        type: 'withdrawal_release',
                        description: "Releasing frozen funds for rejected withdrawal request #{$withdrawal->id}",
                        idempotencyKey: "WDR-{$withdrawal->id}_RELEASE",
                        metadata: ['withdrawal_id' => $withdrawal->id],
                    );

                    $this->ledgerService->credit(
                        user: $user,
                        amount: $withdrawal->amount,
                        currency: $wallet->currency,
                        walletType: $walletType,
                        balanceCategory: 'withdrawable',
                        type: 'withdrawal_release',
                        description: "Releasing frozen funds for rejected withdrawal request #{$withdrawal->id}",
                        idempotencyKey: "WDR-{$withdrawal->id}_RELEASE_CREDIT",
                        metadata: ['withdrawal_id' => $withdrawal->id],
                    );
                }

                $this->notifications->actionEmail(
                    user: $user,
                    title: 'Your withdrawal request was declined',
                    bodyHtml: '<p>Your withdrawal request of <strong>'.e($withdrawal->currency).' '.number_format($withdrawal->amount, 2).'</strong> was not approved.</p><p><strong>Reason:</strong> '.e($validated['rejection_reason']).'</p>',
                    actionLabel: 'View wallet',
                    actionUrl: NotificationService::link('wallet'),
                    template: 'withdrawal_rejected',
                    data: [
                        'currency' => e($withdrawal->currency),
                        'amount' => number_format($withdrawal->amount, 2),
                        'reason' => e($validated['rejection_reason']),
                    ],
                );

                return response()->json(['message' => 'Withdrawal rejected.', 'data' => $withdrawal]);
            }

            return response()->json(['message' => 'Unsupported action.'], 422);
        });
    }

    /**
     * Approval creates the provider transfer. The withdrawal is NOT completed here. It completes only when
     * the provider confirms the transfer (webhook), so an admin cannot pay a withdrawal the provider has
     * not confirmed.
     */
    private function approve(int $id, Request $request): JsonResponse
    {
        $withdrawal = WithdrawalRequest::find($id);
        if (! $withdrawal) {
            return response()->json(['message' => 'Withdrawal not found.'], 404);
        }

        try {
            $payout = app(PayoutSettlementService::class)->dispatch($withdrawal, $request->user()->id);
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage(), 'code' => $e->errorCode], $e->statusCode);
        }

        return response()->json([
            'message' => 'Withdrawal approved. The transfer is with the provider and completes only when the provider confirms it.',
            'data' => $withdrawal->fresh(),
            'payout' => ['id' => $payout->id, 'status' => $payout->status->value, 'provider' => $payout->provider],
        ], 202);
    }

    /**
     * Recovery: re-sends a transfer the provider did not accept. The provider de-duplicates on the same
     * reference. This never credits or debits the wallet, and it never completes the withdrawal.
     */
    public function adminRetryTransfer(Request $request, int $id): JsonResponse
    {
        if (! $request->user()->hasAdminPermission('payouts')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $withdrawal = WithdrawalRequest::find($id);
        if (! $withdrawal) {
            return response()->json(['message' => 'Withdrawal not found.'], 404);
        }

        try {
            $payout = app(PayoutSettlementService::class)->retry($withdrawal, $request->user()->id);
        } catch (PaymentException $e) {
            return response()->json(['message' => $e->getMessage(), 'code' => $e->errorCode], $e->statusCode);
        }

        return response()->json([
            'message' => 'Transfer sent again. The withdrawal completes only when the provider confirms it.',
            'data' => $withdrawal->fresh(),
            'payout' => ['id' => $payout->id, 'status' => $payout->status->value],
        ], 202);
    }
}
