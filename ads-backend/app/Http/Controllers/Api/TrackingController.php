<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Ad;
use App\Models\AdMetric;
use App\Models\AdWallet;
use App\Models\AdConversion;
use App\Services\Billing\LedgerService;

class TrackingController extends Controller
{
    protected LedgerService $ledger;

    public function __construct(LedgerService $ledger)
    {
        $this->ledger = $ledger;
    }

    /**
     * Log an ad impression.
     */
    public function impression(Request $request)
    {
        $validated = $request->validate([
            'ad_id' => 'required|exists:ads,id',
            'user_id' => 'required|integer'
        ]);

        $adId = $validated['ad_id'];

        $metric = AdMetric::firstOrCreate(
            ['ad_id' => $adId, 'date' => now()->toDateString()],
            ['impressions' => 0, 'clicks' => 0, 'spend' => 0]
        );

        $metric->increment('impressions');

        return response()->json(['status' => 'success']);
    }

    /**
     * Log an ad click and charge the CPC.
     */
    public function click(Request $request)
    {
        $validated = $request->validate([
            'ad_id' => 'required|exists:ads,id',
            'user_id' => 'required|integer'
        ]);

        $ad = Ad::with('adGroup.campaign')->findOrFail($validated['ad_id']);
        $wallet = AdWallet::where('advertiser_id', $ad->adGroup->campaign->advertiser_id)->first();

        // Standard mock CPC (e.g., $0.15 = 15 cents)
        $cpc = 15;

        // Try to charge reserved funds. 
        // In a real flow, the delivery engine reserved the funds upfront, and here we officially debit it.
        // If not enough reserved, we fallback or fail gracefully. For MVP, we directly charge available if needed.
        if ($wallet) {
            try {
                if ($wallet->reserved_balance >= $cpc) {
                    $this->ledger->chargeReservedFunds($wallet, $cpc, 'ad_click', $ad->id);
                } else if ($wallet->available_balance >= $cpc) {
                    $this->ledger->reserveFunds($wallet, $cpc, 'ad_click', $ad->id);
                    $this->ledger->chargeReservedFunds($wallet, $cpc, 'ad_click', $ad->id);
                } else {
                    throw new \Exception("Insufficient funds");
                }
                
                // Update metrics
                $metric = AdMetric::firstOrCreate(
                    ['ad_id' => $ad->id, 'date' => now()->toDateString()],
                    ['impressions' => 0, 'clicks' => 0, 'spend' => 0]
                );
                
                $metric->increment('clicks');
                $metric->increment('spend', $cpc);

            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error("Failed to charge for click on ad {$ad->id}: " . $e->getMessage());
                return response()->json(['status' => 'error', 'message' => 'Billing failed'], 400);
            }
        }
        
        $this->checkLearningPhase($ad);

        return response()->json(['status' => 'success', 'redirect' => $ad->cta_url]);
    }

    /**
     * Log a native conversion (purchase, follow, community join)
     */
    public function conversion(Request $request)
    {
        $validated = $request->validate([
            'ad_id' => 'required|exists:ads,id',
            'user_id' => 'required|integer',
            'type' => 'required|string|in:purchase,follow,community',
            'value' => 'nullable|integer',
            'reference_id' => 'required|string'
        ]);

        try {
            // Log the conversion event (ignores duplicates due to unique constraint in DB)
            $conversion = AdConversion::create([
                'ad_id' => $validated['ad_id'],
                'user_id' => $validated['user_id'],
                'type' => $validated['type'],
                'value' => $validated['value'] ?? 0,
                'reference_id' => $validated['reference_id'],
            ]);

            // Update daily metrics rollup
            $metric = AdMetric::firstOrCreate(
                ['ad_id' => $validated['ad_id'], 'date' => now()->toDateString()],
                ['impressions' => 0, 'clicks' => 0, 'spend' => 0]
            );

            if ($validated['type'] === 'purchase') {
                $metric->increment('conversions');
                $metric->increment('conversion_value', ($validated['value'] ?? 0));
            } else if ($validated['type'] === 'follow') {
                $metric->increment('follows');
            } else if ($validated['type'] === 'community') {
                $metric->increment('conversions'); 
            }
            
            $ad = Ad::find($validated['ad_id']);
            if ($ad) {
                $this->checkLearningPhase($ad);
            }

            return response()->json(['status' => 'success']);
        } catch (\Illuminate\Database\QueryException $e) {
            $errorCode = $e->errorInfo[1];
            if($errorCode == 1062 || $errorCode == 19) { // Duplicate entry
                return response()->json(['status' => 'success', 'message' => 'Duplicate conversion ignored'], 200);
            }
            throw $e;
        }
    }

    /**
     * Check if an Ad has accumulated enough data to exit the learning phase.
     */
    private function checkLearningPhase(Ad $ad)
    {
        if ($ad->optimization_status === 'learning') {
            $totalConversionsAndClicks = AdMetric::where('ad_id', $ad->id)
                ->where('date', '>=', now()->subDays(7)->toDateString())
                ->sum(\DB::raw('clicks + conversions + follows'));
                
            if ($totalConversionsAndClicks >= 50) {
                $ad->optimization_status = 'active';
                $ad->save();
            }
        }
    }
}
