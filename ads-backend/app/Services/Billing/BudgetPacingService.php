<?php

namespace App\Services\Billing;

use App\Models\AdWallet;
use App\Models\Campaign;
use App\Models\AdGroup;
use App\Models\AdMetric;
use App\Services\Billing\LedgerService;

class BudgetPacingService
{
    protected LedgerService $ledger;

    public function __construct(LedgerService $ledger)
    {
        $this->ledger = $ledger;
    }

    /**
     * Check if a wallet has enough available funds to enter the auction.
     */
    public function hasSufficientWalletBalance(AdWallet $wallet, int $requiredMinimum = 100): bool
    {
        return $wallet->available_balance >= $requiredMinimum;
    }

    /**
     * Check if the AdGroup is pacing within its daily budget.
     */
    public function hasPacingAvailable(AdGroup $adGroup): bool
    {
        $campaign = $adGroup->campaign;
        
        if ($campaign->budget_type !== 'daily' || !$campaign->budget_amount) {
            return true;
        }

        $currentHour = (int) now()->format('G'); 
        $expectedSpend = ($campaign->budget_amount / 24) * ($currentHour + 1);

        $actualSpend = AdMetric::whereHas('ad', function ($query) use ($campaign) {
            $query->whereHas('adGroup', function ($q) use ($campaign) {
                $q->where('campaign_id', $campaign->id);
            });
        })->where('date', now()->toDateString())->sum('spend');

        return $actualSpend < $expectedSpend;
    }

    /**
     * Reserve budget for a specific AdGroup for a batch of auctions.
     */
    public function reserveAdGroupBudget(AdGroup $adGroup, int $amountToReserve): bool
    {
        // 1. Check if AdGroup daily/lifetime budget allows it (simplified for now)
        // In a real system, we would track daily spend in Redis or a dedicated table.
        
        $campaign = $adGroup->campaign;
        
        $actualSpend = AdMetric::whereHas('ad.adGroup', function ($q) use ($campaign) {
            $q->where('campaign_id', $campaign->id);
        })->sum('spend');
        
        if ($campaign->budget_amount && ($actualSpend + $amountToReserve > $campaign->budget_amount)) {
            return false;
        }

        $wallet = AdWallet::where('advertiser_id', $campaign->advertiser_id)->first();
        
        if (!$wallet || !$this->hasSufficientWalletBalance($wallet, $amountToReserve)) {
            return false;
        }

        try {
            $this->ledger->reserveFunds($wallet, $amountToReserve, 'ad_group', $adGroup->id);
            return true;
        } catch (\Exception $e) {
            // Log exception
            return false;
        }
    }
}
