<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Services\NotificationService;
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

        if (! $wallet->verifyPin($validated['pin'])) {
            return response()->json(['message' => 'Incorrect transaction PIN.', 'code' => 'INVALID_TRANSACTION_PIN'], 403);
        }

        // `withdrawable` is the authoritative column for withdrawal eligibility.
        // A zero withdrawable balance means no funds are eligible — do not fall back to `available`.
        if ($wallet->withdrawable < $validated['amount']) {
            return response()->json(['message' => 'Insufficient withdrawable balance.', 'code' => 'INSUFFICIENT_BALANCE'], 422);
        }

        $destCurrency = strtoupper($validated['currency'] ?? 'NGN');
        $rateService = app(\App\Services\Payment\LiveExchangeRateService::class);
        $rate = $rateService->getRate('USD', $destCurrency);
        $estimatedLocal = round(($validated['amount'] / 100.0) * $rate, 2);

        $withdrawal = WithdrawalRequest::create([
            'user_id'  => $request->user()->id,
            'amount'   => $validated['amount'], // in USD cents
            'currency' => $destCurrency,
            'status'   => 'pending',
        ]);

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
        $targetCurrency = strtoupper($validated['destination_currency'] ?? 'NGN');
        $amountUsdCents = (int) $validated['amount'];
        $amountUsd = $amountUsdCents / 100.0;

        $feeUsd = max(1.0, round($amountUsd * 0.015, 2));
        $netUsd = max(0.0, $amountUsd - $feeUsd);

        $rateService = app(\App\Services\Payment\LiveExchangeRateService::class);
        $rate = $rateService->getRate('USD', $targetCurrency);
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

        return \Illuminate\Support\Facades\DB::transaction(function () use ($id, $validated, $request) {
            $withdrawal = WithdrawalRequest::where('id', $id)->lockForUpdate()->firstOrFail();

            if ($withdrawal->status !== 'pending') {
                return response()->json(['message' => 'Withdrawal already processed.', 'code' => 'ALREADY_PROCESSED'], 409);
            }

            if ($validated['action'] === 'reject') {
                $withdrawal->update([
                    'status' => 'rejected',
                    'rejection_reason' => $validated['rejection_reason'],
                    'processed_by' => $request->user()->id,
                    'processed_at' => now(),
                ]);

                $user = User::find($withdrawal->user_id);
                if (! $user) {
                    return response()->json(['message' => 'Withdrawal owner not found.', 'code' => 'USER_NOT_FOUND'], 404);
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

            $user = User::find($withdrawal->user_id);
            if (! $user || ! $user->hasVerifiedKyc()) {
                return response()->json([
                    'message' => 'This user has not completed KYC identity verification. Withdrawals are blocked until KYC is verified.',
                    'code' => 'KYC_REQUIRED',
                ], 403);
            }

            // Resolve wallet via WalletService (LedgerService no longer exposes getOrCreateWallet)
            $walletType = $withdrawal->wallet_type ?? 'creator';
            $wallet = $this->walletService->getOrCreateWallet($user, $walletType);

            if ($wallet->withdrawable < $withdrawal->amount) {
                return response()->json(['message' => 'Insufficient withdrawable balance for withdrawal.', 'code' => 'INSUFFICIENT_BALANCE'], 422);
            }

            $ledgerTxn = $this->ledgerService->debit(
                user: $user,
                amount: $withdrawal->amount,
                currency: $withdrawal->currency,
                walletType: $walletType,
                balanceCategory: 'withdrawable',
                type: 'withdrawal',
                description: "Withdrawal request #{$withdrawal->id}",
                idempotencyKey: "WDR-{$withdrawal->id}",
            );

            $withdrawal->update([
                'status' => 'completed',
                'processed_by' => $request->user()->id,
                'processed_at' => now(),
                'ledger_transaction_id' => $ledgerTxn->id,
            ]);

            $this->notifications->actionEmail(
                user: $user,
                title: 'Your withdrawal has been processed',
                bodyHtml: '<p>Your withdrawal of <strong>'.e($withdrawal->currency).' '.number_format($withdrawal->amount, 2).'</strong> has been approved and is being sent to your account. Funds will appear shortly.</p>',
                actionLabel: 'View wallet',
                actionUrl: NotificationService::link('wallet'),
                template: 'withdrawal_approved',
                data: [
                    'currency' => e($withdrawal->currency),
                    'amount' => number_format($withdrawal->amount, 2),
                ],
            );

            return response()->json(['message' => 'Withdrawal approved and processed.', 'data' => $withdrawal->fresh()]);
        });
    }
}
