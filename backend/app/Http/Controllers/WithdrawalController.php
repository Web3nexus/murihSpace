<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Services\NotificationService;
use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WithdrawalController extends Controller
{
    public function __construct(
        private LedgerService $ledgerService,
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
            'amount' => ['required', 'integer', 'min:100'],
            'currency' => ['nullable', 'string', 'max:3'],
            'pin' => ['required', 'string', 'digits:4'],
        ]);

        $wallet = $this->ledgerService->getOrCreateWallet($request->user()->id);

        if (! $wallet->verifyPin($validated['pin'])) {
            return response()->json(['message' => 'Incorrect transaction PIN.', 'code' => 'INVALID_TRANSACTION_PIN'], 403);
        }

        if ($wallet->balance < $validated['amount']) {
            return response()->json(['message' => 'Insufficient balance.', 'code' => 'INSUFFICIENT_BALANCE'], 422);
        }

        $currency = $validated['currency'] ?? 'NGN';

        $withdrawal = WithdrawalRequest::create([
            'user_id' => $request->user()->id,
            'amount' => $validated['amount'],
            'currency' => $currency,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Withdrawal request submitted for review.',
            'data' => $withdrawal,
        ], 201);
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
        $validated = $request->validate([
            'action' => ['required', 'string', 'in:approve,reject'],
            'rejection_reason' => ['required_if:action,reject', 'nullable', 'string', 'max:1000'],
        ]);

        $withdrawal = WithdrawalRequest::findOrFail($id);

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

        $wallet = $this->ledgerService->getOrCreateWallet($withdrawal->user_id);

        if ($wallet->balance < $withdrawal->amount) {
            return response()->json(['message' => 'Insufficient balance for withdrawal.', 'code' => 'INSUFFICIENT_BALANCE'], 422);
        }

        $ledgerTxn = $this->ledgerService->debit(
            $withdrawal->user_id,
            $withdrawal->amount,
            $withdrawal->currency,
            'withdrawal',
            "Withdrawal request #{$withdrawal->id}",
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
    }
}
