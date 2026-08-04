<?php

namespace App\Http\Controllers;

use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Wallet\LedgerService;
use App\Services\Wallet\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminWalletController extends Controller
{
    public function __construct(
        private readonly WalletService $walletService,
        private readonly LedgerService $ledgerService,
    ) {}

    /**
     * GET /api/v1/securegate/wallets
     * List all user wallets across types (system, creator, business).
     */
    public function index(Request $request): JsonResponse
    {
        $query = Wallet::with('user:id,name,email,username,role')->latest();

        if ($request->filled('type')) {
            $query->where('wallet_type', $request->input('type'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('username', 'like', "%{$search}%");
            });
        }

        $wallets = $query->paginate(20);

        return response()->json($wallets);
    }

    /**
     * GET /api/v1/securegate/wallets/ledger
     * Full cross-wallet double-entry ledger explorer.
     */
    public function ledger(Request $request): JsonResponse
    {
        $query = LedgerTransaction::with(['entries.user:id,name,email,username'])->latest();

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $transactions = $query->paginate(25);

        return response()->json($transactions);
    }

    /**
     * POST /api/v1/securegate/wallets/{id}/adjust
     * Admin manual balance adjustment (with double-entry ledger record).
     */
    public function adjust(Request $request, int $id): JsonResponse
    {
        $wallet = Wallet::with('user')->findOrFail($id);

        $validated = $request->validate([
            'action'           => ['required', 'string', 'in:credit,debit'],
            'balance_category' => ['required', 'string', 'in:available,pending,reserved,escrow,withdrawable,disputed'],
            'amount'           => ['required', 'integer', 'min:1'],
            'reason'           => ['required', 'string', 'max:255'],
        ]);

        $amount    = (int) $validated['amount'];
        $category  = $validated['balance_category'];
        $action    = $validated['action'];
        $reason    = $validated['reason'];
        $user      = $wallet->user;

        try {
            if ($action === 'credit') {
                $txn = $this->ledgerService->credit(
                    user: $user,
                    amount: $amount,
                    currency: $wallet->currency,
                    walletType: $wallet->wallet_type,
                    balanceCategory: $category,
                    type: 'admin_adjustment',
                    description: "Admin credit adjustment: {$reason}",
                    metadata: ['admin_id' => $request->user()->id, 'reason' => $reason]
                );
            } else {
                $txn = $this->ledgerService->debit(
                    user: $user,
                    amount: $amount,
                    currency: $wallet->currency,
                    walletType: $wallet->wallet_type,
                    balanceCategory: $category,
                    type: 'admin_adjustment',
                    description: "Admin debit adjustment: {$reason}",
                    metadata: ['admin_id' => $request->user()->id, 'reason' => $reason]
                );
            }

            return response()->json([
                'message'     => 'Wallet adjusted successfully.',
                'transaction' => $txn,
                'wallet'      => $wallet->fresh(),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
