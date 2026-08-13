<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAdRequest;
use App\Http\Requests\UpdateAdRequest;
use App\Models\Ad;
use Illuminate\Http\Request;

use App\Models\AdAccountMember;
use App\Models\AdGroup;

class AdController extends Controller
{
    private function getAuthorizedAccountIds()
    {
        return AdAccountMember::where('murihspace_user_id', request()->user()->id)
            ->pluck('ad_account_id');
    }

    public function index(Request $request)
    {
        $query = Ad::whereHas('adGroup.campaign', function($q) {
            $q->whereIn('advertiser_id', $this->getAuthorizedAccountIds());
        });
        
        if ($request->has('ad_group_id')) {
            $query->where('ad_group_id', $request->query('ad_group_id'));
        }
        
        $ads = $query->with('creative')->paginate(20);
        return response()->json($ads);
    }

    public function store(StoreAdRequest $request)
    {
        $adGroup = AdGroup::whereHas('campaign', function($q) {
            $q->whereIn('advertiser_id', $this->getAuthorizedAccountIds());
        })->find($request->input('ad_group_id'));

        if (!$adGroup) {
            return response()->json(['error' => 'Unauthorized ad group'], 403);
        }

        $ad = Ad::create($request->validated());
        return response()->json($ad, 201);
    }

    public function show($id)
    {
        $ad = Ad::with('creative')
            ->whereHas('adGroup.campaign', function($q) {
                $q->whereIn('advertiser_id', $this->getAuthorizedAccountIds());
            })->findOrFail($id);
        return response()->json($ad);
    }

    public function update(UpdateAdRequest $request, $id)
    {
        $ad = Ad::whereHas('adGroup.campaign', function($q) {
                $q->whereIn('advertiser_id', $this->getAuthorizedAccountIds());
            })->findOrFail($id);

        if ($request->has('ad_group_id') && $request->input('ad_group_id') != $ad->ad_group_id) {
            $adGroup = AdGroup::whereHas('campaign', function($q) {
                $q->whereIn('advertiser_id', $this->getAuthorizedAccountIds());
            })->find($request->input('ad_group_id'));

            if (!$adGroup) {
                return response()->json(['error' => 'Unauthorized ad group'], 403);
            }
        }

        $ad->update($request->validated());
        return response()->json($ad);
    }

    public function destroy($id)
    {
        $ad = Ad::whereHas('adGroup.campaign', function($q) {
                $q->whereIn('advertiser_id', $this->getAuthorizedAccountIds());
            })->findOrFail($id);
        $ad->delete();
        return response()->json(null, 204);
    }
}
