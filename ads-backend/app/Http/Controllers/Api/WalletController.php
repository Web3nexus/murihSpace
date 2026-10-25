<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\AdWallet;
use App\Services\Billing\LedgerService;

class WalletController extends Controller
{
    protected LedgerService $ledger;

    public function __construct(LedgerService $ledger)
    {
        $this->ledger = $ledger;
    }

    /**
     * Get the current wallet balance for the authenticated user's active ad account.
     * Note: In a real app, this would extract the active advertiser_id from the user session/token.
     * For now, we will assume a generic advertiser or pass it.
     */
    public function index(Request $request)
    {
        $advertiserId = $request->query('advertiser_id');
        
        if (!$advertiserId) {
            return response()->json(['error' => 'advertiser_id is required'], 400);
        }

        $isMember = \App\Models\AdAccountMember::where('ad_account_id', $advertiserId)
            ->where('murihspace_user_id', $request->user()->murihspace_user_id)
            ->exists();
            
        if (!$isMember) {
            return response()->json(['error' => 'Unauthorized access to this ad account'], 403);
        }

        $wallet = AdWallet::firstOrCreate(
            ['advertiser_id' => $advertiserId],
            ['currency' => 'USD', 'available_balance' => 0, 'reserved_balance' => 0, 'lifetime_spend' => 0]
        );

        return response()->json([
            'data' => $wallet
        ]);
    }

    /**
     * Fund the wallet.
     */
    public function fund(Request $request)
    {
        // Disabled: this credited any amount with no payment behind it. Re-enable only when deposits
        // are confirmed by Murihpay custody.
        return response()->json([
            'message' => 'Deposits are temporarily unavailable.',
            'code' => 'DEPOSITS_DISABLED',
        ], 503);

        $request->validate([
            'advertiser_id' => 'required|exists:advertisers,id',
            'amount' => 'required|integer|min:1', // Amount in cents
        ]);
        
        $advertiserId = $request->input('advertiser_id');

        $isMember = \App\Models\AdAccountMember::where('ad_account_id', $advertiserId)
            ->where('murihspace_user_id', $request->user()->murihspace_user_id)
            ->exists();
            
        if (!$isMember) {
            return response()->json(['error' => 'Unauthorized access to this ad account'], 403);
        }

        $wallet = AdWallet::firstOrCreate(
            ['advertiser_id' => $advertiserId],
            ['currency' => 'USD', 'available_balance' => 0, 'reserved_balance' => 0, 'lifetime_spend' => 0]
        );

        $transaction = $this->ledger->addFunds($wallet, $request->input('amount'), 'Manual deposit via API');

        return response()->json([
            'message' => 'Funds added successfully',
            'wallet' => $wallet->fresh(),
            'transaction' => $transaction
        ]);
    }
}
