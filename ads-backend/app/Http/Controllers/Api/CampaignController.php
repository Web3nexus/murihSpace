<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCampaignRequest;
use App\Http\Requests\UpdateCampaignRequest;
use App\Models\Campaign;
use App\Models\AdAccountMember;
use App\Services\Reporting\AdMetricsAggregator;
use Illuminate\Http\Request;

class CampaignController extends Controller
{
    private function getAuthorizedAccountIds()
    {
        return AdAccountMember::where('murihspace_user_id', request()->user()->murihspace_user_id)
            ->pluck('ad_account_id');
    }

    public function index(Request $request, AdMetricsAggregator $metrics)
    {
        $request->validate(AdMetricsAggregator::rangeRules());

        $campaigns = Campaign::whereIn('advertiser_id', $this->getAuthorizedAccountIds())
            ->paginate(AdMetricsAggregator::perPage($request));

        $metrics->attach($campaigns, AdMetricsAggregator::LEVEL_CAMPAIGN, $request->query('start_date'), $request->query('end_date'));

        return response()->json($campaigns);
    }

    public function store(StoreCampaignRequest $request)
    {
        if (!$this->getAuthorizedAccountIds()->contains($request->input('advertiser_id'))) {
            return response()->json(['error' => 'Unauthorized account'], 403);
        }
        
        $campaign = Campaign::create($request->validated());
        return response()->json($campaign, 201);
    }

    public function show($id)
    {
        $campaign = Campaign::with('adGroups.ads')
            ->whereIn('advertiser_id', $this->getAuthorizedAccountIds())
            ->findOrFail($id);
        return response()->json($campaign);
    }

    public function update(UpdateCampaignRequest $request, $id)
    {
        $campaign = Campaign::whereIn('advertiser_id', $this->getAuthorizedAccountIds())
            ->findOrFail($id);
            
        // If changing advertiser_id, ensure authorized
        if ($request->has('advertiser_id') && !$this->getAuthorizedAccountIds()->contains($request->input('advertiser_id'))) {
            return response()->json(['error' => 'Unauthorized account'], 403);
        }

        $campaign->update($request->validated());
        return response()->json($campaign);
    }

    public function destroy($id)
    {
        $campaign = Campaign::whereIn('advertiser_id', $this->getAuthorizedAccountIds())
            ->findOrFail($id);
        $campaign->delete();
        return response()->json(null, 204);
    }
}
