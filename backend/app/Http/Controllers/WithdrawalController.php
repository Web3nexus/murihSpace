<?php

namespace App\Http\Controllers;

use App\Models\WithdrawalRequest;
use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WithdrawalController extends Controller
{
    public function __construct(
        private LedgerService $ledgerService,
    ) {}

    public function request(Request $request): JsonResponse
    {
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
        $requests = WithdrawalRequest::with(['user:id,name,username'])
            ->latest()
            ->paginate(20);

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

            return response()->json(['message' => 'Withdrawal rejected.', 'data' => $withdrawal]);
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

        return response()->json(['message' => 'Withdrawal approved and processed.', 'data' => $withdrawal->fresh()]);
    }
}
