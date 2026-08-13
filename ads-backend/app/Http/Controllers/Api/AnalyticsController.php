<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Campaign;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * Get aggregate analytics for the dashboard.
     */
    public function report(Request $request)
    {
        $advertiserId = $request->query('advertiser_id');

        if (!$advertiserId) {
            return response()->json(['error' => 'advertiser_id is required'], 400);
        }

        $isMember = \App\Models\AdAccountMember::where('ad_account_id', $advertiserId)
            ->where('murihspace_user_id', $request->user()->id)
            ->exists();
            
        if (!$isMember) {
            return response()->json(['error' => 'Unauthorized access to this ad account'], 403);
        }

        // Fetch total metrics for this advertiser
        $campaigns = Campaign::where('advertiser_id', $advertiserId)->pluck('id');

        $metrics = DB::table('ad_metrics')
            ->join('ads', 'ad_metrics.ad_id', '=', 'ads.id')
            ->join('ad_groups', 'ads.ad_group_id', '=', 'ad_groups.id')
            ->whereIn('ad_groups.campaign_id', $campaigns)
            ->selectRaw('
                SUM(impressions) as total_impressions,
                SUM(clicks) as total_clicks,
                SUM(spend) as total_spend,
                SUM(conversions) as total_conversions,
                SUM(conversion_value) as total_conversion_value
            ')
            ->first();

        $impressions = (int) $metrics->total_impressions;
        $clicks = (int) $metrics->total_clicks;
        $spend = (int) $metrics->total_spend;
        $conversions = (int) $metrics->total_conversions;
        $revenue = (int) $metrics->total_conversion_value;

        $ctr = $impressions > 0 ? round(($clicks / $impressions) * 100, 2) : 0.00;
        $cpa = $conversions > 0 ? round(($spend / 100) / $conversions, 2) : 0.00;
        $roas = $spend > 0 ? round($revenue / $spend, 2) : 0.00;

        // Daily breakdown for charts
        $daily = DB::table('ad_metrics')
            ->join('ads', 'ad_metrics.ad_id', '=', 'ads.id')
            ->join('ad_groups', 'ads.ad_group_id', '=', 'ad_groups.id')
            ->whereIn('ad_groups.campaign_id', $campaigns)
            ->where('date', '>=', now()->subDays(7)->toDateString())
            ->groupBy('date')
            ->orderBy('date', 'asc')
            ->selectRaw('date, SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(spend) as spend, SUM(conversions) as conversions, SUM(conversion_value) as conversion_value')
            ->get();

        return response()->json([
            'summary' => [
                'spend_usd' => $spend / 100, // Convert minor to major unit
                'revenue_usd' => $revenue / 100,
                'impressions' => $impressions,
                'clicks' => $clicks,
                'conversions' => $conversions,
                'ctr' => $ctr,
                'cpa' => $cpa,
                'roas' => $roas
            ],
            'chart_data' => $daily
        ]);
    }
}
