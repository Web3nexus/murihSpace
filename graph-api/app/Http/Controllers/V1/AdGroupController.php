<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\AdsApiClient;
use App\Support\ResponseNormaliser;

/**
 * Phase 3: Ad groups and their contained ads.
 *
 * GET /v1/ad-groups/{id}       — single ad group
 * GET /v1/ad-groups/{id}/ads   — ads within an ad group
 */
class AdGroupController extends Controller
{
    public function __construct(private readonly AdsApiClient $adsApi) {}

    /** GET /v1/ad-groups/{id} */
    public function show(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->adsApi->getAdGroup($id, $userId);

        return response()->json([
            'data' => ResponseNormaliser::adGroup($data['data'] ?? $data),
            'meta' => [],
        ]);
    }

    /** GET /v1/ad-groups/{id}/ads */
    public function ads(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->adsApi->getAds($id, $request->only(['cursor', 'limit', 'status']), $userId);

        return response()->json(ResponseNormaliser::collection($data));
    }
}
