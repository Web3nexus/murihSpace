<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAdGroupRequest;
use App\Http\Requests\UpdateAdGroupRequest;
use App\Models\AdGroup;
use App\Services\Reporting\AdMetricsAggregator;
use Illuminate\Http\Request;

use App\Models\AdAccountMember;
use App\Models\Campaign;

class AdGroupController extends Controller
{
    private function getAuthorizedAccountIds()
    {
        return AdAccountMember::where('murihspace_user_id', request()->user()->murihspace_user_id)
            ->pluck('ad_account_id');
    }

    public function index(Request $request, AdMetricsAggregator $metrics)
    {
        $request->validate(AdMetricsAggregator::rangeRules());

        $query = AdGroup::whereHas('campaign', function($q) {
            $q->whereIn('advertiser_id', $this->getAuthorizedAccountIds());
        });
        
        if ($request->has('campaign_id')) {
            $query->where('campaign_id', $request->query('campaign_id'));
        }
        
        $adGroups = $query->paginate(AdMetricsAggregator::perPage($request));

        $metrics->attach($adGroups, AdMetricsAggregator::LEVEL_AD_GROUP, $request->query('start_date'), $request->query('end_date'));

        return response()->json($adGroups);
    }

    public function store(StoreAdGroupRequest $request)
    {
        $campaign = Campaign::whereIn('advertiser_id', $this->getAuthorizedAccountIds())
            ->find($request->input('campaign_id'));
            
        if (!$campaign) {
            return response()->json(['error' => 'Unauthorized campaign'], 403);
        }

        $adGroup = AdGroup::create($request->validated());
        return response()->json($adGroup, 201);
    }

    public function show($id)
    {
        $adGroup = AdGroup::with('ads')
            ->whereHas('campaign', function($q) {
                $q->whereIn('advertiser_id', $this->getAuthorizedAccountIds());
            })->findOrFail($id);
        return response()->json($adGroup);
    }

    public function update(UpdateAdGroupRequest $request, $id)
    {
        $adGroup = AdGroup::whereHas('campaign', function($q) {
                $q->whereIn('advertiser_id', $this->getAuthorizedAccountIds());
            })->findOrFail($id);

        if ($request->has('campaign_id') && $request->input('campaign_id') != $adGroup->campaign_id) {
            $campaign = Campaign::whereIn('advertiser_id', $this->getAuthorizedAccountIds())
                ->find($request->input('campaign_id'));
            if (!$campaign) {
                return response()->json(['error' => 'Unauthorized campaign'], 403);
            }
        }

        $adGroup->update($request->validated());
        return response()->json($adGroup);
    }

    public function destroy($id)
    {
        $adGroup = AdGroup::whereHas('campaign', function($q) {
                $q->whereIn('advertiser_id', $this->getAuthorizedAccountIds());
            })->findOrFail($id);
        $adGroup->delete();
        return response()->json(null, 204);
    }
}
