<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\AdsApiClient;
use App\Support\ResponseNormaliser;

/**
 * Phase 3: Individual ads and their creatives.
 *
 * GET /v1/ads/{id}              — single ad
 * GET /v1/ads/{id}/creative     — creative attached to an ad
 */
class AdController extends Controller
{
    public function __construct(private readonly AdsApiClient $adsApi) {}

    /** GET /v1/ads/{id} */
    public function show(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->adsApi->getAd($id, $userId);

        return response()->json([
            'data' => ResponseNormaliser::ad($data['data'] ?? $data),
            'meta' => [],
        ]);
    }

    /** GET /v1/ads/{id}/creative */
    public function creative(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->adsApi->getCreatives($id, [], $userId);

        // Creatives are returned as a collection; pick the first if singular expected
        $creative = $data['data'][0] ?? ($data[0] ?? $data);

        return response()->json([
            'data' => ResponseNormaliser::creative($creative),
            'meta' => [],
        ]);
    }
}
