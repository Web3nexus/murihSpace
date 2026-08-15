<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\AdsApiClient;
use App\Support\ResponseNormaliser;

/**
 * Phase 3: Campaigns.
 *
 * GET /v1/campaigns/{id}               — single campaign
 * GET /v1/campaigns/{id}/ad-groups     — ad groups in a campaign
 * GET /v1/campaigns/{id}/ads           — all ads in a campaign (flattened)
 */
class CampaignController extends Controller
{
    public function __construct(private readonly AdsApiClient $adsApi) {}

    /** GET /v1/campaigns/{id} */
    public function show(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->adsApi->getCampaign($id, $userId);

        return response()->json([
            'data' => ResponseNormaliser::campaign($data['data'] ?? $data),
            'meta' => [],
        ]);
    }

    /** GET /v1/campaigns/{id}/ad-groups */
    public function adGroups(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->adsApi->getAdGroups($id, $request->only(['cursor', 'limit', 'status']), $userId);

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/campaigns/{id}/ads — convenience flattened view */
    public function ads(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');
        // Fetch ad groups first, then flatten ads (limited depth — max 1 level)
        $adGroupsData = $this->adsApi->getAdGroups($id, [], $userId);
        $adGroups     = $adGroupsData['data'] ?? $adGroupsData;

        $ads = [];
        foreach (array_slice($adGroups, 0, 10) as $group) { // safety cap
            $groupAds = $this->adsApi->getAds($group['id'], $request->only(['limit']), $userId);
            foreach ($groupAds['data'] ?? $groupAds as $ad) {
                $ads[] = ResponseNormaliser::ad($ad);
            }
        }

        return response()->json([
            'data'   => $ads,
            'paging' => ['has_more' => false],
            'meta'   => [],
        ]);
    }
}
