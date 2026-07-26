<?php

namespace App\Http\Controllers;

use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\Wallet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReconciliationController extends Controller
{
    public function audit(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $wallets = Wallet::with('user:id,name,username')->get();
        $issues = [];

        foreach ($wallets as $wallet) {
            $ledgerBalance = LedgerEntry::where('user_id', $wallet->user_id)
                ->where('account_type', 'user_wallet')
                ->selectRaw("SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END) as net")
                ->value('net') ?? 0;

            $difference = $wallet->balance - $ledgerBalance;

            if ($difference !== 0) {
                $issues[] = [
                    'user_id' => $wallet->user_id,
                    'user' => $wallet->user,
                    'wallet_balance' => $wallet->balance,
                    'ledger_balance' => $ledgerBalance,
                    'difference' => $difference,
                    'currency' => $wallet->currency,
                ];
            }
        }

        $unbalancedTxns = LedgerTransaction::whereHas('entries', function ($q) {
            // Only transactions where net sum != 0
        })->get()->filter(fn ($t) => ! $t->isBalanced())->values();

        return response()->json([
            'data' => [
                'wallet_count' => $wallets->count(),
                'discrepancies' => count($issues),
                'unbalanced_transactions' => $unbalancedTxns->count(),
                'issues' => $issues,
                'unbalanced_txns' => $unbalancedTxns->load('entries'),
                'audited_at' => now()->toIso8601String(),
            ],
        ]);
    }

    public function ledgerSummary(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $summary = [
            'total_credits' => LedgerEntry::where('entry_type', 'credit')->sum('amount'),
            'total_debits' => LedgerEntry::where('entry_type', 'debit')->sum('amount'),
            'by_type' => LedgerTransaction::selectRaw("type, COUNT(*) as count, SUM((SELECT SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END) FROM ledger_entries WHERE ledger_entries.ledger_transaction_id = ledger_transactions.id)) as net")
                ->groupBy('type')
                ->get(),
            'escrow_summary' => [
                'held' => \App\Models\Escrow::where('status', 'held')->sum('amount'),
                'released' => \App\Models\Escrow::where('status', 'released')->sum('amount'),
                'refunded' => \App\Models\Escrow::where('status', 'refunded')->sum('amount'),
                'disputed' => \App\Models\Escrow::where('status', 'disputed')->sum('amount'),
                'open_disputes' => \App\Models\Dispute::whereIn('status', ['open', 'under_review'])->count(),
            ],
        ];

        return response()->json(['data' => $summary]);
    }
}
