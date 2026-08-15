<?php

namespace App\Services\Delivery;

use App\Models\Ad;
use App\Models\AdGroup;
use App\Services\Billing\BudgetPacingService;
use Illuminate\Support\Collection;

class AuctionService
{
    protected BudgetPacingService $budgetPacing;

    public function __construct(BudgetPacingService $budgetPacing)
    {
        $this->budgetPacing = $budgetPacing;
    }

    /**
     * Run an auction to find the best ad for a given user and placement.
     */
    public function runAuction(int $userId, string $placement): ?Ad
    {
        // Step 1: Candidate Generation
        // Fetch all active ads where the ad group and campaign are also active.
        $candidates = Ad::with(['adGroup', 'adGroup.campaign', 'creative', 'metrics'])
            ->where('status', 'active')
            ->whereHas('adGroup', function ($q) use ($placement) {
                $q->where('status', 'active')
                  ->whereHas('campaign', function ($cq) {
                      $cq->where('status', 'active');
                  });
            })
            ->get();
            
        $advertiserIds = $candidates->pluck('adGroup.campaign.advertiser_id')->filter()->unique();
        $wallets = \App\Models\AdWallet::whereIn('advertiser_id', $advertiserIds)->get()->keyBy('advertiser_id');

        // Pre-fetch requesting user's audience IDs to prevent N+1 queries in filter loop
        $userAudienceIds = \App\Models\AudienceUser::where('user_identifier', (string) $userId)
            ->pluck('audience_id')
            ->toArray();

        // Step 2: Filtering
        $eligibleAds = $candidates->filter(function (Ad $ad) use ($userId, $placement, $wallets, $userAudienceIds) {
            $adGroup = $ad->adGroup;

            // Placement check (simplified: assume JSON placements array exists)
            $placements = $adGroup->placements ?? [];
            if (!empty($placements) && !in_array($placement, $placements)) {
                return false;
            }

            // Audience check
            $audienceTargeting = $adGroup->audience_targeting ?? [];
            if (!empty($audienceTargeting['custom_audience_ids'])) {
                $audienceIds = $audienceTargeting['custom_audience_ids'];
                if (empty(array_intersect($audienceIds, $userAudienceIds))) {
                    return false;
                }
            }

            // Budget check (simulate reserving 1 cent to see if wallet has funds)
            $wallet = $wallets->get($adGroup->campaign->advertiser_id);
            if (!$wallet || !$this->budgetPacing->hasSufficientWalletBalance($wallet, 1)) {
                return false;
            }

            // Pacing check: ensure daily budget isn't exhausted prematurely
            if (!$this->budgetPacing->hasPacingAvailable($adGroup)) {
                return false;
            }

            return true;
        });

        if ($eligibleAds->isEmpty()) {
            return null;
        }

        // Step 3: Scoring (Calculate eCPM = Bid × Estimated CTR × Relevance)
        // Bid amount is in cents (minor units).
        $scoredAds = $eligibleAds->map(function (Ad $ad) {
            $bidAmount = $ad->adGroup->bid_amount ?? 0;
            
            // In production, these are ML models. Here we mock them.
            $estimatedCtr = $this->predictCtr($ad); 
            $relevanceScore = $this->calculateRelevance($ad);
            
            // Calculate eCPM
            $eCpm = $bidAmount * $estimatedCtr * $relevanceScore;
            
            $ad->score = $eCpm;
            return $ad;
        });

        // Sort descending by score
        $sortedAds = $scoredAds->sortByDesc('score')->values();

        // Step 4: Determine Winner
        $winner = $sortedAds->first();

        // Optional: Reserve funds for the impression/click here, or log a delivery event
        // $this->budgetPacing->reserveAdGroupBudget($winner->adGroup, 1);

        return $winner;
    }

    /**
     * CTR prediction using Bayesian smoothing (Explore vs Exploit)
     */
    private function predictCtr(Ad $ad): float
    {
        $metrics = $ad->metrics;
        $totalImpressions = $metrics->sum('impressions');
        $totalClicks = $metrics->sum('clicks');

        // Global Average CTR prior
        $globalPriorCtr = 0.015; // 1.5%

        if ($totalImpressions < 500) {
            // Bayesian smoothing for new ads (explore)
            // Weight the prior by 500 impressions
            $smoothedImpressions = $totalImpressions + 500;
            $smoothedClicks = $totalClicks + (500 * $globalPriorCtr);
            return $smoothedClicks / $smoothedImpressions;
        }

        // Exploit: Actual CTR
        return $totalImpressions > 0 ? ($totalClicks / $totalImpressions) : $globalPriorCtr;
    }

    /**
     * Mock Relevance Score (0.1 to 1.0)
     */
    private function calculateRelevance(Ad $ad): float
    {
        // Base deterministic relevance score until real models are integrated
        return 1.0;
    }
}
